import { requireWorkspaceAccess, requireWorkspaceEditor } from "@/lib/auth/workspace-access";
import { calculatePatrimonyNet } from "@/lib/finance/patrimony";
import { positionMarketValue } from "@/lib/finance/investments";
import { calculateAccountBalance, calculateNetWorth } from "@/lib/finance/aggregates";
import { db } from "@/lib/db";
import { listWorkspaceMovements } from "@/server/repositories/ledger";
import { decimal } from "@/lib/finance/money";
import { findAccountInWorkspace } from "@/server/repositories/account-guard";
import { writeFinancialAuditLog } from "@/server/audit/financial-audit";
import {
  liabilityPaymentPayloadMatches,
  type LiabilityPaymentPayload,
} from "@/lib/finance/liability-payment-idempotency";
import { listNetWorthSnapshots } from "@/server/services/net-worth-snapshot";
import { Prisma } from "@/generated/prisma/client";
import {
  linkedLiabilityBankPaymentWarning,
  linkedRecurringConfirmWarning,
} from "@/lib/finance/liability-recurring-duplicate-risk";
import { findRecentLinkedRecurringBankPayment } from "@/server/services/linked-liability-payment-evidence";

export type RecordLiabilityPaymentResult =
  | {
      ok: true;
      liability: { id: string; outstandingBalance: { toString(): string } };
    }
  | { ok: false; reason: "invalid" | "linked_liability_ack_required"; message?: string };

async function findLiabilityInWorkspace(workspaceId: string, liabilityId: string) {
  return db.financialLiability.findFirst({
    where: { id: liabilityId, workspaceId },
  });
}

export async function getPatrimonyOverview(userId: string, workspaceId: string) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const [accounts, movements, positions, liabilities, snapshots, linkedRecurring] =
    await Promise.all([
    db.financialAccount.findMany({ where: { workspaceId, isArchived: false } }),
    listWorkspaceMovements(workspaceId),
    db.investmentPosition.findMany({ where: { workspaceId } }),
    db.financialLiability.findMany({ where: { workspaceId } }),
    listNetWorthSnapshots(userId, workspaceId),
    db.recurringExpense.findMany({
      where: { workspaceId, status: "ACTIVE", linkedLiabilityId: { not: null } },
      select: { linkedLiabilityId: true },
    }),
  ]);

  const liabilityIdsWithLinkedRecurring = new Set(
    linkedRecurring.map((r) => r.linkedLiabilityId!).filter(Boolean),
  );

  const accountSnapshots = accounts.map((a) => ({
    id: a.id,
    openingBalance: a.openingBalance.toString(),
    type: a.type,
    isIncludedInNetWorth: a.isIncludedInNetWorth,
    isArchived: a.isArchived,
  }));

  const patrimony = calculatePatrimonyNet({
    accounts: accountSnapshots,
    movements,
    investmentPositions: positions.map((p) => ({
      quantity: p.quantity.toString(),
      manualPrice: p.manualPrice.toString(),
      valuationMode: p.valuationMode,
      linkedAccountId: p.linkedAccountId,
    })),
    manualLiabilities: liabilities.map((l) => ({
      outstandingBalance: l.outstandingBalance.toString(),
    })),
  });

  const accountRows = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    isIncludedInNetWorth: account.isIncludedInNetWorth,
    balance: calculateAccountBalance(
      account.openingBalance.toString(),
      movements,
      account.id,
    ).toFixed(2),
  }));

  const investmentRows = positions.map((p) => ({
    id: p.id,
    symbol: p.symbol,
    name: p.name,
    assetClass: p.assetClass,
    valuationMode: p.valuationMode,
    linkedAccountId: p.linkedAccountId,
    isCountedSeparately: p.valuationMode !== "ACCOUNT_COMPONENT" && !p.linkedAccountId,
    marketValue: positionMarketValue(p.quantity.toString(), p.manualPrice.toString()),
  }));

  return {
    ...patrimony,
    accountNetWorthFromEngine: calculateNetWorth(accountSnapshots, movements).toFixed(2),
    accounts: accountRows,
    investments: investmentRows,
    liabilities: liabilities.map((l) => ({
      id: l.id,
      title: l.title,
      type: l.type,
      outstandingBalance: l.outstandingBalance.toString(),
      monthlyPayment: l.monthlyPayment?.toString() ?? null,
      paymentDueDayOfMonth: l.paymentDueDayOfMonth,
      hasActiveLinkedRecurring: liabilityIdsWithLinkedRecurring.has(l.id),
    })),
    snapshots: snapshots ?? [],
  };
}

export async function createLiability(
  userId: string,
  workspaceId: string,
  input: {
    title: string;
    type: "PERSONAL_LOAN" | "AUTO_LOAN" | "MORTGAGE" | "FAMILY_LOAN" | "OTHER";
    outstandingBalance: string;
    monthlyPayment?: string;
    paymentDueDayOfMonth?: number | null;
    manualRatePercent?: string;
    notes?: string;
  },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const outstandingBalance = decimal(input.outstandingBalance).toString();
  const monthlyPayment = input.monthlyPayment
    ? decimal(input.monthlyPayment).toString()
    : undefined;
  const manualRatePercent = input.manualRatePercent
    ? decimal(input.manualRatePercent).toString()
    : undefined;

  const row = await db.financialLiability.create({
    data: {
      workspaceId,
      userId,
      title: input.title,
      type: input.type,
      outstandingBalance,
      monthlyPayment,
      paymentDueDayOfMonth: input.paymentDueDayOfMonth ?? null,
      manualRatePercent,
      notes: input.notes,
    },
  });

  await writeFinancialAuditLog({
    workspaceId,
    actorUserId: userId,
    action: "LIABILITY_CREATED",
    entityType: "FinancialLiability",
    entityId: row.id,
  });

  return row;
}

export async function updateLiabilitySchedule(
  userId: string,
  workspaceId: string,
  liabilityId: string,
  input: { paymentDueDayOfMonth: number | null },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const liability = await findLiabilityInWorkspace(workspaceId, liabilityId);
  if (!liability) return null;

  return db.financialLiability.update({
    where: { id: liabilityId },
    data: { paymentDueDayOfMonth: input.paymentDueDayOfMonth },
  });
}

export async function listWorkspaceLiabilities(userId: string, workspaceId: string) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  return db.financialLiability.findMany({
    where: { workspaceId },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      outstandingBalance: true,
      monthlyPayment: true,
      paymentDueDayOfMonth: true,
    },
  });
}

export async function recordLiabilityPayment(
  userId: string,
  workspaceId: string,
  input: {
    liabilityId: string;
    paidAt: Date;
    principalAmount: string;
    interestAmount: string;
    feesAmount?: string;
    notes?: string;
    mode?: "LIABILITY_ONLY" | "WITH_BANK";
    accountId?: string;
    idempotencyKey?: string;
    acknowledgeLinkedLiabilityRisk?: boolean;
  },
): Promise<RecordLiabilityPaymentResult> {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return { ok: false, reason: "invalid" };

  const principal = decimal(input.principalAmount);
  const interest = decimal(input.interestAmount);
  const fees = decimal(input.feesAmount ?? "0");
  const economicExpense = interest.plus(fees);

  if (principal.lt(0) || interest.lt(0) || fees.lt(0)) {
    return { ok: false, reason: "invalid" };
  }

  const mode = input.mode ?? "LIABILITY_ONLY";
  if (mode === "WITH_BANK") {
    if (!input.accountId) return { ok: false, reason: "invalid" };
    const account = await findAccountInWorkspace(workspaceId, input.accountId);
    if (!account) return { ok: false, reason: "invalid" };

    const linkedRecurring = await db.recurringExpense.findFirst({
      where: {
        workspaceId,
        linkedLiabilityId: input.liabilityId,
        status: "ACTIVE",
      },
    });
    if (linkedRecurring && !input.acknowledgeLinkedLiabilityRisk) {
      const liability = await findLiabilityInWorkspace(workspaceId, input.liabilityId);
      const recent = await findRecentLinkedRecurringBankPayment(
        workspaceId,
        input.liabilityId,
        input.paidAt,
      );
      let message = linkedRecurringConfirmWarning(
        linkedRecurring.name,
        liability?.title ?? "passivo",
      );
      if (recent) {
        message = linkedLiabilityBankPaymentWarning(
          liability?.title ?? "passivo",
          recent.recurringName,
          recent.paidAt.toISOString().slice(0, 10),
        );
      }
      return { ok: false, reason: "linked_liability_ack_required", message };
    }
  }

  const payload: LiabilityPaymentPayload = {
    liabilityId: input.liabilityId,
    principalAmount: principal.toFixed(2),
    interestAmount: interest.toFixed(2),
    feesAmount: fees.toFixed(2),
    accountId: input.accountId,
    mode,
  };

  let updated: {
    liabilityRow: { id: string; outstandingBalance: { toString(): string } };
    paymentId: string;
    isNewPayment: boolean;
  };

  try {
    updated = await db.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const existing = await tx.liabilityPayment.findFirst({
          where: { workspaceId, idempotencyKey: input.idempotencyKey },
          include: { liability: true },
        });
        if (existing) {
          if (!liabilityPaymentPayloadMatches(existing, payload)) {
            throw new IdempotencyConflictError();
          }
          return {
            liabilityRow: existing.liability,
            paymentId: existing.id,
            isNewPayment: false,
          };
        }
      }

      const liability = await tx.financialLiability.findFirst({
        where: { id: input.liabilityId, workspaceId },
      });
      if (!liability) {
        throw new NotFoundError();
      }

      const newBalance = decimal(liability.outstandingBalance.toString()).minus(
        principal,
      );
      if (newBalance.lt(0)) {
        throw new InvalidPaymentError();
      }

    let principalTransactionId: string | undefined;
    let expenseTransactionId: string | undefined;

    if (mode === "WITH_BANK" && input.accountId) {
      const cashPrincipal = principal.gt(0)
        ? await tx.transaction.create({
            data: {
              workspaceId,
              accountId: input.accountId,
              userId,
              type: "ADJUSTMENT",
              status: "COMPLETED",
              amount: principal.negated().toFixed(2),
              occurredAt: input.paidAt,
              description: `Amortização capital · ${liability.title}`,
            },
          })
        : null;

      principalTransactionId = cashPrincipal?.id;

      if (economicExpense.gt(0)) {
        const expenseTx = await tx.transaction.create({
          data: {
            workspaceId,
            accountId: input.accountId,
            userId,
            type: "EXPENSE",
            status: "COMPLETED",
            amount: economicExpense.negated().toFixed(2),
            occurredAt: input.paidAt,
            description: `Juros/encargos · ${liability.title}`,
          },
        });
        expenseTransactionId = expenseTx.id;
      }
    }

      const payment = await tx.liabilityPayment.create({
        data: {
          workspaceId,
          liabilityId: liability.id,
          userId,
          paidAt: input.paidAt,
          principalAmount: principal.toFixed(2),
          interestAmount: interest.toFixed(2),
          feesAmount: fees.toFixed(2),
          accountId: mode === "WITH_BANK" ? input.accountId : null,
          principalTransactionId,
          expenseTransactionId,
          idempotencyKey: input.idempotencyKey,
          notes: input.notes,
        },
      });

      const liabilityRow = await tx.financialLiability.update({
        where: { id: liability.id },
        data: { outstandingBalance: newBalance.toFixed(2) },
      });

      return { liabilityRow, paymentId: payment.id, isNewPayment: true };
    });
  } catch (error) {
    if (error instanceof IdempotencyConflictError) return { ok: false, reason: "invalid" };
    if (error instanceof NotFoundError) return { ok: false, reason: "invalid" };
    if (error instanceof InvalidPaymentError) return { ok: false, reason: "invalid" };
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      input.idempotencyKey
    ) {
      const existing = await db.liabilityPayment.findFirst({
        where: { workspaceId, idempotencyKey: input.idempotencyKey },
        include: { liability: true },
      });
      if (
        existing &&
        liabilityPaymentPayloadMatches(existing, payload)
      ) {
        return { ok: true, liability: existing.liability };
      }
      return { ok: false, reason: "invalid" };
    }
    throw error;
  }

  if (updated.isNewPayment) {
    await writeFinancialAuditLog({
      workspaceId,
      actorUserId: userId,
      action: "LIABILITY_PAYMENT_RECORDED",
      entityType: "LiabilityPayment",
      entityId: updated.paymentId,
      metadata: {
        mode,
        principal: principal.toFixed(2),
        economicExpense: economicExpense.toFixed(2),
      },
    });
  }

  return { ok: true, liability: updated.liabilityRow };
}

class IdempotencyConflictError extends Error {
  constructor() {
    super("idempotency_conflict");
  }
}

class NotFoundError extends Error {
  constructor() {
    super("not_found");
  }
}

class InvalidPaymentError extends Error {
  constructor() {
    super("invalid_payment");
  }
}
