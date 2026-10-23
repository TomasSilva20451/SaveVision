import "server-only";

import { requireWorkspaceEditor } from "@/lib/auth/workspace-access";
import { civilDateFromInstant, formatCivilDateIso } from "@/lib/datetime/civil-date";
import { decimal } from "@/lib/finance/money";
import { normalizeCategorizationPattern } from "@/lib/finance/transaction-categorization";
import { db } from "@/lib/db";
import { isPrismaMissingTableError } from "@/lib/db/prisma-missing-table";
import { rememberTransactionCategorizationDecision } from "@/server/services/transaction-categorization-rules";
import { suggestTransactionCategorization } from "@/server/services/transaction-categorization";
import { getLocalAiSettings, isLocalAiActive } from "@/server/services/local-ai-settings";

const REVIEW_MONTHS = 12;
const CANDIDATE_CAP = 500;
const BATCH_LIMIT = 20;
const REJECT_COOLDOWN_DAYS = 30;

export type CategorizationReviewRow = {
  suggestionId: string;
  transactionId: string;
  occurredAt: string;
  description: string;
  amount: string;
  type: "INCOME" | "EXPENSE";
  currentCategoryId: string | null;
  currentCategoryName: string | null;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
  suggestedMerchant: string;
  confidence: number;
  source: "RULE" | "OLLAMA";
  provider: string;
};

function reviewWindowStart(): Date {
  const civil = civilDateFromInstant(new Date());
  let month = civil.month - REVIEW_MONTHS;
  let year = civil.year;
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  return new Date(Date.UTC(year, month - 1, 1));
}

async function isDriftCandidate(
  workspaceId: string,
  tx: { description: string | null; categoryId: string | null; type: string },
): Promise<boolean> {
  if (!tx.description || (tx.type !== "INCOME" && tx.type !== "EXPENSE")) return false;
  const rules = await db.transactionCategorizationRule.findMany({
    where: { workspaceId, transactionType: tx.type as "INCOME" | "EXPENSE", categoryId: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  const normalized = normalizeCategorizationPattern(tx.description);
  const match = rules
    .filter((rule) => normalized.includes(rule.pattern))
    .sort((a, b) => b.pattern.length - a.pattern.length)[0];
  if (!match?.categoryId) return false;
  return match.categoryId !== tx.categoryId;
}

export async function listPendingCategorizationReviews(
  userId: string,
  workspaceId: string,
): Promise<CategorizationReviewRow[] | null> {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const now = new Date();
  let rows;
  try {
    rows = await db.transactionCategorizationSuggestion.findMany({
      where: {
        workspaceId,
        status: "PENDING",
        OR: [{ rejectedUntil: null }, { rejectedUntil: { lt: now } }],
      },
      include: {
        transaction: { include: { category: true } },
        category: true,
      },
      orderBy: { computedAt: "desc" },
      take: 100,
    });
  } catch (error) {
    if (isPrismaMissingTableError(error)) return [];
    throw error;
  }

  return rows.map((row) => ({
    suggestionId: row.id,
    transactionId: row.transactionId,
    occurredAt: formatCivilDateIso(civilDateFromInstant(row.transaction.occurredAt)),
    description: row.transaction.description ?? "",
    amount: decimal(row.transaction.amount.toString()).abs().toFixed(2),
    type: row.transaction.type as "INCOME" | "EXPENSE",
    currentCategoryId: row.transaction.categoryId,
    currentCategoryName: row.transaction.category?.name ?? null,
    suggestedCategoryId: row.suggestedCategoryId,
    suggestedCategoryName: row.category?.name ?? null,
    suggestedMerchant: row.suggestedMerchant,
    confidence: row.confidence,
    source: row.source,
    provider: row.provider,
  }));
}

async function findCandidateTransactionIds(workspaceId: string): Promise<string[]> {
  const since = reviewWindowStart();
  const transactions = await db.transaction.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      status: "COMPLETED",
      type: { in: ["INCOME", "EXPENSE"] },
      occurredAt: { gte: since },
    },
    select: {
      id: true,
      description: true,
      categoryId: true,
      type: true,
      categorizationSuggestion: { select: { status: true, rejectedUntil: true } },
    },
    orderBy: { occurredAt: "desc" },
    take: CANDIDATE_CAP,
  });

  const ids: string[] = [];
  for (const tx of transactions) {
    const suggestion = tx.categorizationSuggestion;
    if (suggestion?.status === "PENDING") continue;
    if (suggestion?.status === "REJECTED" && suggestion.rejectedUntil && suggestion.rejectedUntil > new Date()) {
      continue;
    }
    if (!tx.categoryId || (await isDriftCandidate(workspaceId, tx))) {
      ids.push(tx.id);
    }
  }
  return ids;
}

export async function computeSuggestionsForTransactions(
  userId: string,
  workspaceId: string,
  input?: { transactionIds?: string[]; limit?: number },
): Promise<{
  processed: number;
  candidates: number;
  localAiActive: boolean;
  skippedSameCategory: number;
  skippedNoSuggestion: number;
  ollamaErrors: number;
} | null> {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const aiSettings = await getLocalAiSettings(userId);
  const localAiActive = isLocalAiActive(aiSettings);
  const limit = Math.min(input?.limit ?? BATCH_LIMIT, BATCH_LIMIT);
  const ids =
    input?.transactionIds?.slice(0, limit) ??
    (await findCandidateTransactionIds(workspaceId)).slice(0, Math.max(limit * 3, limit));

  let processed = 0;
  let skippedSameCategory = 0;
  let skippedNoSuggestion = 0;
  let ollamaErrors = 0;
  for (const transactionId of ids) {
    if (processed >= limit) break;
    const tx = await db.transaction.findFirst({
      where: { id: transactionId, workspaceId, deletedAt: null },
    });
    if (!tx || (tx.type !== "INCOME" && tx.type !== "EXPENSE")) continue;
    if (!tx.description || tx.description.trim().length < 3) continue;

    const direction = tx.type as "INCOME" | "EXPENSE";
    let suggestion;
    let suggestError: string | null = null;
    try {
      suggestion = await suggestTransactionCategorization(userId, workspaceId, {
        description: tx.description,
        amount: decimal(tx.amount.toString()).abs().toFixed(2),
        direction,
        forceCategory: direction === "EXPENSE",
      });
    } catch (e) {
      ollamaErrors += 1;
      suggestError = e instanceof Error ? e.message : "unknown";
      suggestion = null;
    }
    if (suggestError) continue;
    if (!suggestion?.categoryId) {
      skippedNoSuggestion += 1;
      continue;
    }
    if (suggestion.categoryId === tx.categoryId) {
      skippedSameCategory += 1;
      continue;
    }

    await db.transactionCategorizationSuggestion.upsert({
      where: { transactionId: tx.id },
      create: {
        workspaceId,
        transactionId: tx.id,
        suggestedCategoryId: suggestion.categoryId,
        suggestedMerchant: suggestion.merchant,
        confidence: suggestion.confidence,
        source: suggestion.source,
        provider: suggestion.provider,
        status: "PENDING",
      },
      update: {
        suggestedCategoryId: suggestion.categoryId,
        suggestedMerchant: suggestion.merchant,
        confidence: suggestion.confidence,
        source: suggestion.source,
        provider: suggestion.provider,
        status: "PENDING",
        rejectedUntil: null,
        computedAt: new Date(),
      },
    });
    processed += 1;
  }

  const summary = {
    processed,
    candidates: ids.length,
    localAiActive,
    skippedSameCategory,
    skippedNoSuggestion,
    ollamaErrors,
  };
  return summary;
}

export async function applyCategorizationReview(
  userId: string,
  workspaceId: string,
  input: { suggestionIds: string[]; accept: boolean },
): Promise<{ updated: number } | null> {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  let updated = 0;
  const cooldown = new Date();
  cooldown.setDate(cooldown.getDate() + REJECT_COOLDOWN_DAYS);

  for (const suggestionId of input.suggestionIds) {
    const row = await db.transactionCategorizationSuggestion.findFirst({
      where: { id: suggestionId, workspaceId, status: "PENDING" },
      include: { transaction: true },
    });
    if (!row) continue;

    if (input.accept && row.suggestedCategoryId) {
      await db.transaction.update({
        where: { id: row.transactionId },
        data: { categoryId: row.suggestedCategoryId },
      });
      await rememberTransactionCategorizationDecision({
        userId,
        workspaceId,
        description: row.transaction.description ?? "",
        transactionType: row.transaction.type as "INCOME" | "EXPENSE",
        selectedCategoryId: row.suggestedCategoryId,
        decision: {
          merchant: row.suggestedMerchant,
          suggestedCategoryId: row.suggestedCategoryId,
          source: row.source,
        },
      });
      await db.transactionCategorizationSuggestion.update({
        where: { id: row.id },
        data: {
          status: "ACCEPTED",
          decidedAt: new Date(),
          decidedByUserId: userId,
        },
      });
      updated += 1;
    } else if (!input.accept) {
      await db.transactionCategorizationSuggestion.update({
        where: { id: row.id },
        data: {
          status: "REJECTED",
          rejectedUntil: cooldown,
          decidedAt: new Date(),
          decidedByUserId: userId,
        },
      });
      updated += 1;
    }
  }

  return { updated };
}
