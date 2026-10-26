import { requireWorkspaceAccess, requireWorkspaceEditor, requireWorkspaceManager } from "@/lib/auth/workspace-access";
import { hasCorporateCapability } from "@/lib/corporate/rbac";
import { civilDateFromInstant, formatCivilDateIso, startOfCivilMonth } from "@/lib/datetime/civil-date";
import { parseBankFeedCsv } from "@/lib/finance/bank-feed-csv";
import {
  scoreReconciliationPair,
  suggestReconciliationMatches,
  type ReconcileBankLine,
  type ReconcileLedgerTx,
} from "@/lib/finance/bank-reconciliation";
import { mapOpenBankingTransactions } from "@/lib/finance/open-banking-feed";
import { decimal } from "@/lib/finance/money";
import { db } from "@/lib/db";
import { appendAuditEvent } from "@/server/audit/audit-ledger";
import { resolveOpenBankingProvider } from "@/server/providers/open-banking/registry";
import { importBankFeedRows } from "@/server/services/bank-feed-import";
import { dispatchWorkspaceWebhooks } from "@/server/services/webhook-delivery";

const UNMATCHED_TX_MONTHS = 6;

function startOfCivilMonthsAgo(months: number): Date {
  const ref = civilDateFromInstant(new Date());
  let month = ref.month - months;
  let year = ref.year;
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  return startOfCivilMonth(year, month);
}

export async function getReconciliationPageData(userId: string, workspaceId: string) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const canEdit = hasCorporateCapability(membership.role, "reconcile");

  const [accounts, unmatchedCount, matchedCount, duplicateCount, recentUnmatched] = await Promise.all([
    db.financialAccount.findMany({
      where: { workspaceId, isArchived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, institution: true },
    }),
    db.bankFeedLine.count({ where: { workspaceId, status: "UNMATCHED" } }),
    db.bankReconciliationMatch.count({ where: { workspaceId } }),
    db.bankFeedLine.count({ where: { workspaceId, status: "DUPLICATE" } }),
    db.bankFeedLine.findMany({
      where: { workspaceId, status: "UNMATCHED" },
      orderBy: { bookingDate: "desc" },
      take: 40,
      include: { account: { select: { name: true } } },
    }),
  ]);

  const from = startOfCivilMonthsAgo(UNMATCHED_TX_MONTHS);
  const unmatchedTransactions = await db.transaction.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      bankReconciliationMatch: null,
      occurredAt: { gte: from },
      status: "COMPLETED",
    },
    orderBy: { occurredAt: "desc" },
    take: 80,
    select: { id: true, amount: true, occurredAt: true, description: true, accountId: true },
  });

  const copilotSuggestions = recentUnmatched.flatMap((line) => {
    const best = unmatchedTransactions
      .filter((tx) => tx.accountId === line.accountId)
      .map((tx) =>
        scoreReconciliationPair(
          {
            id: line.id,
            amount: line.amount.toString(),
            bookingDate: line.bookingDate,
            description: line.description,
          },
          {
            id: tx.id,
            amount: tx.amount.toString(),
            occurredAt: tx.occurredAt,
            description: tx.description,
          },
        ),
      )
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
      .sort((a, b) => b.confidence - a.confidence)[0];
    return best ? [{ ...best, humanReviewRequired: true as const }] : [];
  });

  return {
    canEdit,
    role: membership.role,
    accounts,
    kpis: { unmatchedCount, matchedCount, duplicateCount },
    feedLines: recentUnmatched.map((line) => ({
      id: line.id,
      accountName: line.account.name,
      bookingDate: line.bookingDate,
      amount: line.amount.toString(),
      description: line.description,
    })),
    candidateTransactions: unmatchedTransactions.map((tx) => ({
      id: tx.id,
      accountId: tx.accountId,
      amount: tx.amount.toString(),
      occurredAt: tx.occurredAt,
      description: tx.description,
    })),
    copilotSuggestions,
  };
}

export async function importBankFeedCsv(
  userId: string,
  workspaceId: string,
  input: { accountId: string; csvText: string },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership || !hasCorporateCapability(membership.role, "import-bank-feed")) return null;

  const account = await db.financialAccount.findFirst({
    where: { id: input.accountId, workspaceId, isArchived: false },
  });
  if (!account) return null;

  const parsed = parseBankFeedCsv(input.csvText);
  const created = await importBankFeedRows(workspaceId, input.accountId, parsed);

  await dispatchWorkspaceWebhooks(workspaceId, "bank_feed.imported", {
    accountId: input.accountId,
    imported: created.imported,
    duplicates: created.duplicates,
  });

  await appendAuditEvent({
    actorUserId: userId,
    workspaceId,
    action: "BANK_FEED_IMPORTED",
    resourceType: "BankFeedLine",
    resourceId: input.accountId,
    outcome: "SUCCESS",
    source: "bank-reconciliation",
    metadata: { imported: created.imported, duplicates: created.duplicates },
  });

  return created;
}

export async function runAutoReconciliation(userId: string, workspaceId: string, accountId?: string) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership || !hasCorporateCapability(membership.role, "reconcile")) return null;

  const lines = await db.bankFeedLine.findMany({
    where: {
      workspaceId,
      status: "UNMATCHED",
      ...(accountId ? { accountId } : {}),
    },
    orderBy: { bookingDate: "asc" },
  });
  if (lines.length === 0) return { matched: 0 };

  const accountIds = [...new Set(lines.map((l) => l.accountId))];
  const from = startOfCivilMonthsAgo(UNMATCHED_TX_MONTHS);

  const transactions = await db.transaction.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      bankReconciliationMatch: null,
      accountId: accountId ? accountId : { in: accountIds },
      occurredAt: { gte: from },
      status: "COMPLETED",
    },
  });

  const bankLines: ReconcileBankLine[] = lines.map((l) => ({
    id: l.id,
    amount: l.amount.toString(),
    bookingDate: l.bookingDate,
    description: l.description,
  }));
  const ledger: ReconcileLedgerTx[] = transactions.map((t) => ({
    id: t.id,
    amount: t.amount.toString(),
    occurredAt: t.occurredAt,
    description: t.description,
  }));

  const suggestions = suggestReconciliationMatches(bankLines, ledger);
  let matched = 0;

  for (const suggestion of suggestions) {
    const applied = await applyReconciliationMatch(userId, workspaceId, {
      bankFeedLineId: suggestion.bankLineId,
      transactionId: suggestion.transactionId,
      confidence: suggestion.confidence,
      method: "AUTO",
    });
    if (applied) {
      matched++;
      await dispatchWorkspaceWebhooks(workspaceId, "reconciliation.matched", {
        bankFeedLineId: suggestion.bankLineId,
        transactionId: suggestion.transactionId,
        method: "AUTO",
        confidence: suggestion.confidence,
      });
    }
  }

  await appendAuditEvent({
    actorUserId: userId,
    workspaceId,
    action: "BANK_RECONCILIATION_AUTO_RUN",
    resourceType: "Workspace",
    resourceId: workspaceId,
    outcome: "SUCCESS",
    source: "bank-reconciliation",
    metadata: { matched, candidates: suggestions.length },
  });

  return { matched };
}

async function applyReconciliationMatch(
  userId: string,
  workspaceId: string,
  input: {
    bankFeedLineId: string;
    transactionId: string;
    confidence: number;
    method: "AUTO" | "MANUAL";
  },
): Promise<boolean> {
  try {
    await db.$transaction(async (tx) => {
      const line = await tx.bankFeedLine.findFirst({
        where: { id: input.bankFeedLineId, workspaceId, status: "UNMATCHED" },
      });
      const movement = await tx.transaction.findFirst({
        where: { id: input.transactionId, workspaceId, deletedAt: null, bankReconciliationMatch: null },
      });
      if (!line || !movement) throw new Error("INVALID_PAIR");
      if (line.accountId !== movement.accountId) throw new Error("ACCOUNT_MISMATCH");
      if (!decimal(line.amount.toString()).eq(movement.amount.toString())) throw new Error("AMOUNT_MISMATCH");

      await tx.bankReconciliationMatch.create({
        data: {
          workspaceId,
          bankFeedLineId: line.id,
          transactionId: movement.id,
          matchedByUserId: input.method === "MANUAL" ? userId : null,
          confidence: input.confidence,
          method: input.method,
        },
      });
      await tx.bankFeedLine.update({
        where: { id: line.id },
        data: { status: "MATCHED" },
      });
    });
    return true;
  } catch {
    return false;
  }
}

export async function confirmManualReconciliationMatch(
  userId: string,
  workspaceId: string,
  input: { bankFeedLineId: string; transactionId: string },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership || !hasCorporateCapability(membership.role, "reconcile")) return null;

  const ok = await applyReconciliationMatch(userId, workspaceId, {
    ...input,
    confidence: 1,
    method: "MANUAL",
  });
  if (!ok) return { ok: false as const };

  await dispatchWorkspaceWebhooks(workspaceId, "reconciliation.matched", {
    bankFeedLineId: input.bankFeedLineId,
    transactionId: input.transactionId,
    method: "MANUAL",
    confidence: 1,
  });

  await appendAuditEvent({
    actorUserId: userId,
    workspaceId,
    action: "BANK_RECONCILIATION_MANUAL",
    resourceType: "BankReconciliationMatch",
    resourceId: input.bankFeedLineId,
    outcome: "SUCCESS",
    source: "bank-reconciliation",
    metadata: { transactionId: input.transactionId },
  });

  return { ok: true as const };
}

export async function registerOpenBankingConsent(
  userId: string,
  workspaceId: string,
  input: { accountId: string; provider: string; consentRef: string },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership || !hasCorporateCapability(membership.role, "open-banking-consent")) return null;

  const account = await db.financialAccount.findFirst({
    where: { id: input.accountId, workspaceId },
  });
  if (!account) return null;

  const consent = await db.openBankingConsent.upsert({
    where: {
      workspaceId_accountId_provider: {
        workspaceId,
        accountId: input.accountId,
        provider: input.provider,
      },
    },
    create: {
      workspaceId,
      accountId: input.accountId,
      provider: input.provider,
      consentRef: input.consentRef,
      status: "ACTIVE",
      readOnly: true,
      grantedAt: new Date(),
    },
    update: {
      consentRef: input.consentRef,
      status: "ACTIVE",
      revokedAt: null,
      grantedAt: new Date(),
    },
  });

  await appendAuditEvent({
    actorUserId: userId,
    workspaceId,
    action: "OPEN_BANKING_CONSENT_REGISTERED",
    resourceType: "OpenBankingConsent",
    resourceId: consent.id,
    outcome: "SUCCESS",
    source: "open-banking",
    metadata: { provider: input.provider, readOnly: true },
  });

  return consent;
}

export async function syncOpenBankingFeed(
  userId: string,
  workspaceId: string,
  input: { consentId: string },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership || !hasCorporateCapability(membership.role, "import-bank-feed")) return null;

  const consent = await db.openBankingConsent.findFirst({
    where: { id: input.consentId, workspaceId, status: "ACTIVE", readOnly: true },
    include: { account: true },
  });
  if (!consent) return null;

  const provider = resolveOpenBankingProvider(consent.provider);
  if (!provider) return { ok: false as const, reason: "PROVIDER_UNAVAILABLE" as const };

  const civil = civilDateFromInstant(new Date());
  const to = formatCivilDateIso(civil);
  const fromDate = startOfCivilMonthsAgo(3);
  const from = formatCivilDateIso(civilDateFromInstant(fromDate));

  const transactions = await provider.fetchTransactions({
    consentRef: consent.consentRef,
    accountExternalRef: consent.accountId,
    from,
    to,
  });

  const rows = mapOpenBankingTransactions(transactions);
  const result = await importBankFeedRows(workspaceId, consent.accountId, rows);

  await dispatchWorkspaceWebhooks(workspaceId, "bank_feed.imported", {
    accountId: consent.accountId,
    provider: consent.provider,
    imported: result.imported,
    duplicates: result.duplicates,
  });

  await appendAuditEvent({
    actorUserId: userId,
    workspaceId,
    action: "OPEN_BANKING_SYNC",
    resourceType: "OpenBankingConsent",
    resourceId: consent.id,
    outcome: "SUCCESS",
    source: "open-banking",
    metadata: { imported: result.imported, provider: consent.provider },
  });

  return { ok: true as const, ...result };
}

export async function listOpenBankingConsents(userId: string, workspaceId: string) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  return db.openBankingConsent.findMany({
    where: { workspaceId },
    include: { account: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function searchWorkspaceAuditEvents(
  userId: string,
  workspaceId: string,
  query: { action?: string; from?: Date; to?: Date; limit?: number },
) {
  const membership = await requireWorkspaceManager(userId, workspaceId);
  if (!membership || !hasCorporateCapability(membership.role, "search-audit")) return null;

  const limit = Math.min(query.limit ?? 100, 200);
  return db.auditEvent.findMany({
    where: {
      workspaceId,
      ...(query.action ? { action: { contains: query.action, mode: "insensitive" } } : {}),
      ...(query.from || query.to
        ? {
            occurredAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    },
    orderBy: { occurredAt: "desc" },
    take: limit,
    select: {
      id: true,
      occurredAt: true,
      action: true,
      resourceType: true,
      resourceId: true,
      outcome: true,
      actorReference: true,
      source: true,
    },
  });
}
