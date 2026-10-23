import { requireWorkspaceAccess, requireWorkspaceEditor } from "@/lib/auth/workspace-access";
import { civilDateIsoToInstant } from "@/lib/datetime/civil-date";
import { db } from "@/lib/db";
import type { RecurrenceFrequency } from "@/lib/finance/recurring-schedule";
import {
  detectRecurringPatterns,
  findVerifiedRecurringPattern,
  recurringSeriesMatchesPattern,
  type DetectedRecurringPattern,
  type RecurringPatternTransaction,
} from "@/lib/finance/recurring-pattern-detection";
import type { RecurringPatternEnrichment } from "@/lib/finance/recurring-pattern-enrichment";
import { enrichRecurringPatternWithOllama } from "@/server/providers/ollama-recurring-pattern-enrichment";

const FREQUENCY_LABEL: Record<RecurrenceFrequency, string> = {
  WEEKLY: "semanal",
  BIWEEKLY: "quinzenal",
  MONTHLY: "mensal",
  QUARTERLY: "trimestral",
  SEMIANNUAL: "semestral",
  YEARLY: "anual",
};

const ENRICHMENT_CACHE_TTL_MS = 10 * 60 * 1000;
const ENRICHMENT_CONCURRENCY = 2;

type CachedEnrichment = {
  expiresAt: number;
  value: RecurringPatternEnrichment | null;
};

const enrichmentCache = new Map<string, CachedEnrichment>();

export type RecurringPatternSuggestionView = DetectedRecurringPattern & {
  title: string;
  summary: string;
  serviceLabel: string;
  kind: string;
  frequencyLabel: string;
  enrichedBy: "OLLAMA" | "RULES";
};

function fallbackSummary(pattern: DetectedRecurringPattern): string {
  return `Detetámos uma possível despesa ${FREQUENCY_LABEL[pattern.frequency]} de ${pattern.merchantDisplay}, no valor aproximado de ${pattern.expectedAmount.replace(".", ",")} €.`;
}

function fallbackTitle(pattern: DetectedRecurringPattern): string {
  return pattern.merchantDisplay;
}

function readCachedEnrichment(suggestionKey: string): RecurringPatternEnrichment | null | undefined {
  const cached = enrichmentCache.get(suggestionKey);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    enrichmentCache.delete(suggestionKey);
    return undefined;
  }
  return cached.value;
}

function writeCachedEnrichment(suggestionKey: string, value: RecurringPatternEnrichment | null) {
  enrichmentCache.set(suggestionKey, {
    value,
    expiresAt: Date.now() + ENRICHMENT_CACHE_TTL_MS,
  });
}

function viewFromPattern(
  pattern: DetectedRecurringPattern,
  enrichment?: RecurringPatternEnrichment | null,
): RecurringPatternSuggestionView {
  const base = {
    ...pattern,
    frequencyLabel: FREQUENCY_LABEL[pattern.frequency],
    title: fallbackTitle(pattern),
    summary: fallbackSummary(pattern),
    serviceLabel: pattern.merchantDisplay,
    kind: "OTHER",
    enrichedBy: "RULES" as const,
  };
  if (!enrichment) return base;
  return {
    ...base,
    title: enrichment.serviceLabel,
    summary: enrichment.summary,
    serviceLabel: enrichment.serviceLabel,
    kind: enrichment.kind,
    merchantDisplay: enrichment.merchant,
    enrichedBy: "OLLAMA",
  };
}

async function enrichPattern(pattern: DetectedRecurringPattern): Promise<RecurringPatternSuggestionView> {
  const cached = readCachedEnrichment(pattern.suggestionKey);
  if (cached !== undefined) {
    return viewFromPattern(pattern, cached);
  }

  try {
    const enrichment = await enrichRecurringPatternWithOllama({
      merchantPattern: pattern.merchantPattern,
      frequency: pattern.frequency,
      expectedAmount: pattern.expectedAmount,
      samples: pattern.evidence.map((item) => ({
        description: item.description,
        occurredAt: item.occurredAt,
        amount: item.amount,
      })),
    });
    writeCachedEnrichment(pattern.suggestionKey, enrichment);
    return viewFromPattern(pattern, enrichment);
  } catch {
    writeCachedEnrichment(pattern.suggestionKey, null);
    return viewFromPattern(pattern, null);
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]!);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function loadDetectionTransactions(workspaceId: string): Promise<RecurringPatternTransaction[]> {
  const transactions = await db.transaction.findMany({
    where: {
      workspaceId,
      type: "EXPENSE",
      status: "COMPLETED",
      deletedAt: null,
      recurringExpenseOccurrence: null,
    },
    orderBy: { occurredAt: "desc" },
    take: 800,
    select: {
      id: true,
      occurredAt: true,
      amount: true,
      description: true,
      categoryId: true,
      accountId: true,
    },
  });

  return transactions.map((tx) => ({
    id: tx.id,
    occurredAt: tx.occurredAt,
    amount: tx.amount.toString(),
    description: tx.description ?? "",
    categoryId: tx.categoryId,
    accountId: tx.accountId,
  }));
}

export async function listRecurringPatternSuggestions(
  userId: string,
  workspaceId: string,
): Promise<RecurringPatternSuggestionView[] | null> {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const [transactions, existingSeries, dismissals, blocks] = await Promise.all([
    loadDetectionTransactions(workspaceId),
    db.recurringExpense.findMany({
      where: { workspaceId },
      select: { name: true, expectedAmount: true, frequency: true, status: true },
    }),
    db.recurringPatternSuggestionDismissal.findMany({
      where: { workspaceId },
      select: { suggestionKey: true },
    }),
    db.recurringPatternMerchantBlock.findMany({
      where: { workspaceId },
      select: { merchantPattern: true },
    }),
  ]);

  const dismissedKeys = new Set(dismissals.map((row) => row.suggestionKey));
  const blockedMerchants = new Set(blocks.map((row) => row.merchantPattern));

  const detected = detectRecurringPatterns({
    transactions,
    existingSeries: existingSeries.map((series) => ({
      name: series.name,
      expectedAmount: series.expectedAmount.toString(),
      frequency: series.frequency as RecurrenceFrequency,
      status: series.status,
    })),
  }).filter(
    (pattern) => !dismissedKeys.has(pattern.suggestionKey) && !blockedMerchants.has(pattern.merchantPattern),
  );

  const top = detected.slice(0, 5);
  return mapWithConcurrency(top, ENRICHMENT_CONCURRENCY, enrichPattern);
}

export async function dismissRecurringPatternSuggestion(
  userId: string,
  workspaceId: string,
  input: { suggestionKey: string; merchantPattern: string },
): Promise<boolean> {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return false;
  await db.recurringPatternSuggestionDismissal.upsert({
    where: {
      workspaceId_suggestionKey: { workspaceId, suggestionKey: input.suggestionKey },
    },
    update: { dismissedByUserId: userId, merchantPattern: input.merchantPattern },
    create: {
      workspaceId,
      suggestionKey: input.suggestionKey,
      merchantPattern: input.merchantPattern,
      dismissedByUserId: userId,
    },
  });
  return true;
}

export async function blockRecurringPatternMerchant(
  userId: string,
  workspaceId: string,
  merchantPattern: string,
): Promise<boolean> {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return false;
  await db.recurringPatternMerchantBlock.upsert({
    where: { workspaceId_merchantPattern: { workspaceId, merchantPattern } },
    update: { blockedByUserId: userId },
    create: { workspaceId, merchantPattern, blockedByUserId: userId },
  });
  return true;
}

export async function createRecurringExpenseFromPatternSuggestion(
  userId: string,
  workspaceId: string,
  input: {
    suggestionKey: string;
    name: string;
    categoryId: string;
    accountId?: string;
    transactionIds: string[];
  },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return { ok: false as const, reason: "FORBIDDEN" as const };

  const uniqueIds = [...new Set(input.transactionIds.filter(Boolean))];
  const [transactions, existingSeries] = await Promise.all([
    loadDetectionTransactions(workspaceId),
    db.recurringExpense.findMany({
      where: { workspaceId, status: { in: ["ACTIVE", "PAUSED"] } },
      select: { name: true, expectedAmount: true, frequency: true, status: true },
    }),
  ]);

  const seriesInput = existingSeries.map((series) => ({
    name: series.name,
    expectedAmount: series.expectedAmount.toString(),
    frequency: series.frequency as RecurrenceFrequency,
    status: series.status,
  }));

  const verified = findVerifiedRecurringPattern({
    transactions,
    existingSeries: seriesInput,
    suggestionKey: input.suggestionKey,
    transactionIds: uniqueIds,
  });
  if (!verified) {
    return { ok: false as const, reason: "EVIDENCE_CHANGED" as const };
  }

  if (
    existingSeries.some((series) =>
      recurringSeriesMatchesPattern(
        {
          name: series.name,
          expectedAmount: series.expectedAmount.toString(),
          frequency: series.frequency as RecurrenceFrequency,
          status: series.status,
        },
        verified,
      ),
    )
  ) {
    return { ok: false as const, reason: "DUPLICATE" as const };
  }

  const category = await db.category.findFirst({
    where: { id: input.categoryId, workspaceId },
    select: { id: true },
  });
  if (!category) return { ok: false as const, reason: "CREATE_FAILED" as const };

  if (input.accountId) {
    const account = await db.financialAccount.findFirst({
      where: { id: input.accountId, workspaceId },
      select: { id: true },
    });
    if (!account) return { ok: false as const, reason: "CREATE_FAILED" as const };
  }

  const { createRecurringExpense } = await import("@/server/services/recurring-expenses");
  const created = await createRecurringExpense(userId, workspaceId, {
    name: input.name.trim().slice(0, 120),
    description: `Sugerida a partir de ${verified.transactionIds.length} movimentos semelhantes.`,
    categoryId: category.id,
    expectedAmount: verified.expectedAmount,
    frequency: verified.frequency,
    startDate: civilDateIsoToInstant(verified.startDate),
    dueDayOfMonth: verified.dueDayOfMonth ?? undefined,
    accountId: input.accountId,
  });
  if (!created) return { ok: false as const, reason: "CREATE_FAILED" as const };

  await dismissRecurringPatternSuggestion(userId, workspaceId, {
    suggestionKey: verified.suggestionKey,
    merchantPattern: verified.merchantPattern,
  });

  return { ok: true as const, seriesId: created.id };
}
