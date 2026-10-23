import {
  requireWorkspaceAccess,
  requireWorkspaceEditor,
} from "@/lib/auth/workspace-access";
import {
  civilDateFromInstant,
  isInstantInCivilMonth,
} from "@/lib/datetime/civil-date";
import { canConfirmExpenseOccurrence } from "@/lib/finance/recurring-expense-confirm";
import { expenseOccurrenceConfirmMatches } from "@/lib/finance/recurring-expense-idempotency";
import {
  civilDateToDueInstant,
  generateRecurringDueDates,
  type RecurrenceFrequency,
} from "@/lib/finance/recurring-schedule";
import { decimal } from "@/lib/finance/money";
import { monthlyEquivalentAmount } from "@/lib/finance/recurring-monthly";
import { db } from "@/lib/db";
import { assertSingleActiveLinkPerLiability } from "@/lib/finance/liability-recurring-link";
import { writeFinancialAuditLog } from "@/server/audit/financial-audit";
import {
  findAccountInWorkspace,
  findCategoryInWorkspace,
} from "@/server/repositories/account-guard";
import { ensureDefaultCategories } from "@/server/services/expenses";
import {
  linkedLiabilityBankPaymentWarning,
  linkedRecurringConfirmWarning,
} from "@/lib/finance/liability-recurring-duplicate-risk";
import {
  findRecentLiabilityBankPayment,
} from "@/server/services/linked-liability-payment-evidence";

const HORIZON_MONTHS = 18;
const MAX_OCCURRENCES = 48;

class IdempotencyConflictError extends Error {
  constructor() {
    super("IDEMPOTENCY_CONFLICT");
  }
}

function supportedFrequency(
  f: string,
): f is RecurrenceFrequency {
  return (
    f === "WEEKLY" ||
    f === "BIWEEKLY" ||
    f === "MONTHLY" ||
    f === "QUARTERLY" ||
    f === "SEMIANNUAL" ||
    f === "YEARLY"
  );
}

function horizonEnd(from: Date): { year: number; month: number; day: number } {
  const civil = civilDateFromInstant(from);
  let month = civil.month + HORIZON_MONTHS;
  let year = civil.year;
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  return { year, month, day: civil.day };
}

async function syncOccurrencesForSeries(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  series: {
    id: string;
    workspaceId: string;
    frequency: string;
    startDate: Date;
    endDate: Date | null;
    dueDayOfMonth: number | null;
    expectedAmount: { toString(): string };
    status: string;
  },
) {
  if (series.status !== "ACTIVE" || !supportedFrequency(series.frequency)) {
    return;
  }

  const start = civilDateFromInstant(series.startDate);
  const endCivil = series.endDate
    ? civilDateFromInstant(series.endDate)
    : horizonEnd(new Date());

  const dates = generateRecurringDueDates({
    frequency: series.frequency,
    start,
    end: endCivil,
    dueDayOfMonth: series.dueDayOfMonth ?? start.day,
    maxOccurrences: MAX_OCCURRENCES,
  });

  for (const d of dates) {
    const dueDate = civilDateToDueInstant(d);
    await tx.recurringExpenseOccurrence.upsert({
      where: {
        recurringExpenseId_anchorDate: {
          recurringExpenseId: series.id,
          anchorDate: dueDate,
        },
      },
      create: {
        workspaceId: series.workspaceId,
        recurringExpenseId: series.id,
        anchorDate: dueDate,
        dueDate,
        expectedAmount: series.expectedAmount.toString(),
        status: "EXPECTED",
      },
      update: {},
    });
  }

  await tx.recurringExpenseOccurrence.updateMany({
    where: {
      recurringExpenseId: series.id,
      status: "EXPECTED",
      expectedAmountCustomized: false,
    },
    data: { expectedAmount: series.expectedAmount.toString() },
  });
}

export async function createRecurringExpense(
  userId: string,
  workspaceId: string,
  input: {
    name: string;
    description?: string;
    categoryId: string;
    expectedAmount: string;
    frequency: RecurrenceFrequency;
    startDate: Date;
    endDate?: Date;
    dueDayOfMonth?: number;
    accountId?: string;
    linkedLiabilityId?: string | null;
  },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const category = await findCategoryInWorkspace(workspaceId, input.categoryId);
  if (!category) return null;

  if (input.accountId) {
    const account = await findAccountInWorkspace(workspaceId, input.accountId);
    if (!account) return null;
  }

  const expectedAmount = decimal(input.expectedAmount).toString();
  if (decimal(expectedAmount).lte(0)) return null;

  let linkedLiabilityId: string | null = input.linkedLiabilityId ?? null;
  if (linkedLiabilityId) {
    const liability = await db.financialLiability.findFirst({
      where: { id: linkedLiabilityId, workspaceId },
    });
    if (!liability) return null;
    const activeLinks = await db.recurringExpense.findMany({
      where: { workspaceId, linkedLiabilityId: { not: null }, status: "ACTIVE" },
      select: { id: true, linkedLiabilityId: true, status: true },
    });
    const conflict = assertSingleActiveLinkPerLiability(
      activeLinks.map((r) => ({
        liabilityId: r.linkedLiabilityId!,
        recurringId: r.id,
        status: r.status,
      })),
      linkedLiabilityId,
      "",
    );
    if (conflict) return null;
  } else {
    linkedLiabilityId = null;
  }

  await ensureDefaultCategories(workspaceId);

  const startCivil = civilDateFromInstant(input.startDate);
  const dueDay = input.dueDayOfMonth ?? startCivil.day;

  return db.$transaction(async (tx) => {
    const series = await tx.recurringExpense.create({
      data: {
        workspaceId,
        userId,
        name: input.name,
        description: input.description,
        categoryId: input.categoryId,
        expectedAmount,
        frequency: input.frequency,
        startDate: civilDateToDueInstant(startCivil),
        endDate: input.endDate,
        dueDayOfMonth: dueDay,
        accountId: input.accountId,
        linkedLiabilityId,
        status: "ACTIVE",
      },
    });

    await syncOccurrencesForSeries(tx, series);
    return series;
  }).then(async (series) => {
    if (!series) return null;
    await writeFinancialAuditLog({
      workspaceId,
      actorUserId: userId,
      action: "RECURRENT_EXPENSE_CREATED",
      entityType: "RecurringExpense",
      entityId: series.id,
    });
    return series;
  });
}

export async function getRecurringExpensesOverview(
  userId: string,
  workspaceId: string,
) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const now = new Date();
  const civil = civilDateFromInstant(now);

  const seriesList = await db.recurringExpense.findMany({
    where: { workspaceId },
    include: {
      category: true,
      account: true,
      occurrences: {
        orderBy: { dueDate: "asc" },
        take: 200,
      },
    },
    orderBy: { name: "asc" },
  });

  for (const s of seriesList.filter((x) => x.status === "ACTIVE")) {
    await db.$transaction(async (tx) => {
      await syncOccurrencesForSeries(tx, s);
    });
  }

  const refreshed = await db.recurringExpense.findMany({
    where: { workspaceId },
    include: {
      category: true,
      account: true,
      linkedLiability: true,
      occurrences: { orderBy: { dueDate: "desc" }, take: 120 },
    },
    orderBy: { name: "asc" },
  });

  const monthOccurrences = await db.recurringExpenseOccurrence.findMany({
    where: { workspaceId },
    include: {
      recurringExpense: { select: { name: true } },
      transaction: {
        select: {
          id: true,
          accountId: true,
          deletedAt: true,
          account: { select: { name: true, type: true } },
        },
      },
    },
  });

  const inMonth = monthOccurrences.filter((o) =>
    isInstantInCivilMonth(o.dueDate, civil.year, civil.month),
  );

  const expectedMonth = inMonth
    .filter((o) => o.status === "EXPECTED" || o.status === "POSTPONED")
    .reduce((s, o) => s.plus(o.expectedAmount.toString()), decimal(0));

  const paidMonth = inMonth
    .filter((o) => o.status === "PAID")
    .reduce(
      (s, o) => s.plus((o.actualAmount ?? o.expectedAmount).toString()),
      decimal(0),
    );

  const unpaidMonth = expectedMonth;

  const activeSeries = refreshed.filter((series) => series.status === "ACTIVE");
  const monthlyEquivalent = activeSeries.reduce(
    (total, series) =>
      total.plus(
        monthlyEquivalentAmount(
          series.expectedAmount.toString(),
          series.frequency,
        ),
      ),
    decimal(0),
  );

  const categoryMonthly = new Map<string, { name: string; value: ReturnType<typeof decimal> }>();
  for (const series of activeSeries) {
    const current = categoryMonthly.get(series.categoryId);
    const amount = decimal(
      monthlyEquivalentAmount(series.expectedAmount.toString(), series.frequency),
    );
    categoryMonthly.set(series.categoryId, {
      name: series.category.name,
      value: (current?.value ?? decimal(0)).plus(amount),
    });
  }

  const monthKeys: { year: number; month: number; key: string; label: string }[] = [];
  const monthLabel = new Intl.DateTimeFormat("pt-PT", {
    month: "short",
    timeZone: "Europe/Lisbon",
  });
  for (let offset = -5; offset <= 0; offset += 1) {
    const base = new Date(Date.UTC(civil.year, civil.month - 1 + offset, 15, 12));
    const year = base.getUTCFullYear();
    const month = base.getUTCMonth() + 1;
    monthKeys.push({
      year,
      month,
      key: `${year}-${String(month).padStart(2, "0")}`,
      label: monthLabel.format(base).replace(".", ""),
    });
  }

  const evolution = monthKeys.map((item) => {
    let expected = decimal(0);
    let paid = decimal(0);
    for (const occurrence of monthOccurrences) {
      if (!isInstantInCivilMonth(occurrence.dueDate, item.year, item.month)) continue;
      if (occurrence.status !== "CANCELLED") {
        expected = expected.plus(occurrence.expectedAmount.toString());
      }
      if (occurrence.status === "PAID") {
        paid = paid.plus(
          (occurrence.actualAmount ?? occurrence.expectedAmount).toString(),
        );
      }
    }
    return {
      key: item.key,
      label: item.label,
      expected: expected.toDecimalPlaces(2).toFixed(2),
      paid: paid.toDecimalPlaces(2).toFixed(2),
    };
  });

  const upcomingHorizon = new Date(Date.now() + 120 * 86_400_000);
  const upcoming = await db.recurringExpenseOccurrence.findMany({
    where: {
      workspaceId,
      status: { in: ["EXPECTED", "POSTPONED"] },
      dueDate: { gte: now, lte: upcomingHorizon },
    },
    include: { recurringExpense: { include: { category: true } } },
    orderBy: { dueDate: "asc" },
    take: 80,
  });

  const categories = await db.category.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });

  return {
    series: refreshed,
    summary: {
      monthlyEquivalent: monthlyEquivalent.toDecimalPlaces(2).toFixed(2),
      expectedMonth: expectedMonth.toFixed(2),
      paidMonth: paidMonth.toFixed(2),
      unpaidMonth: unpaidMonth.toFixed(2),
      activeCount: refreshed.filter((s) => s.status === "ACTIVE").length,
      linkedCount: refreshed.filter((s) => s.linkedLiabilityId !== null).length,
      pausedCount: refreshed.filter((s) => s.status === "PAUSED").length,
      endedCount: refreshed.filter((s) => s.status === "ENDED").length,
      nextDue: upcoming[0] ?? null,
    },
    evolution,
    categoryMonthly: [...categoryMonthly.values()]
      .sort((a, b) => b.value.comparedTo(a.value))
      .map((item) => ({ name: item.name, value: item.value.toFixed(2) })),
    upcoming,
    history: monthOccurrences
      .filter((o) => o.status === "PAID" || o.status === "SKIPPED")
      .sort((a, b) => {
        const aTs = (a.paidAt ?? a.updatedAt).getTime();
        const bTs = (b.paidAt ?? b.updatedAt).getTime();
        return bTs - aTs;
      })
      .slice(0, 40),
    calendarMonth: civil,
    calendarOccurrences: monthOccurrences,
    categories,
  };
}

export async function setRecurringLiabilityLink(
  userId: string,
  workspaceId: string,
  seriesId: string,
  linkedLiabilityId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return { ok: false, error: "Sem permissão." };

  const series = await db.recurringExpense.findFirst({
    where: { id: seriesId, workspaceId },
  });
  if (!series) return { ok: false, error: "Recorrência inexistente." };

  const nextLink = linkedLiabilityId?.trim() ? linkedLiabilityId.trim() : null;

  if (nextLink) {
    const liability = await db.financialLiability.findFirst({
      where: { id: nextLink, workspaceId },
    });
    if (!liability) return { ok: false, error: "Passivo inválido para este workspace." };

    const activeLinks = await db.recurringExpense.findMany({
      where: { workspaceId, linkedLiabilityId: nextLink, status: "ACTIVE" },
      select: { id: true, linkedLiabilityId: true, status: true },
    });
    const conflict = assertSingleActiveLinkPerLiability(
      activeLinks.map((r) => ({
        liabilityId: r.linkedLiabilityId!,
        recurringId: r.id,
        status: r.status,
      })),
      nextLink,
      seriesId,
    );
    if (conflict) return { ok: false, error: conflict };
  }

  await db.recurringExpense.update({
    where: { id: seriesId },
    data: { linkedLiabilityId: nextLink },
  });

  await writeFinancialAuditLog({
    workspaceId,
    actorUserId: userId,
    action: "RECURRENT_EXPENSE_UPDATED",
    entityType: "RecurringExpense",
    entityId: seriesId,
  });

  return { ok: true };
}

export async function updateRecurringExpenseFutureAmount(
  userId: string,
  workspaceId: string,
  seriesId: string,
  newAmount: string,
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const normalizedAmount = decimal(newAmount).toString();
  if (decimal(normalizedAmount).lte(0)) return null;

  return db.$transaction(async (tx) => {
    const updated = await tx.recurringExpense.updateMany({
      where: { id: seriesId, workspaceId },
      data: { expectedAmount: normalizedAmount },
    });
    if (updated.count !== 1) return null;

    await tx.recurringExpenseOccurrence.updateMany({
      where: {
        recurringExpenseId: seriesId,
        workspaceId,
        status: { in: ["EXPECTED", "POSTPONED"] },
        expectedAmountCustomized: false,
      },
      data: { expectedAmount: normalizedAmount },
    });

    await writeFinancialAuditLog({
      workspaceId,
      actorUserId: userId,
      action: "RECURRENT_EXPENSE_UPDATED",
      entityType: "RecurringExpense",
      entityId: seriesId,
      metadata: { expectedAmount: normalizedAmount },
    });

    return true;
  });
}

export async function setRecurringExpenseStatus(
  userId: string,
  workspaceId: string,
  seriesId: string,
  status: "ACTIVE" | "PAUSED" | "ENDED",
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const action =
    status === "PAUSED"
      ? "RECURRENT_EXPENSE_PAUSED"
      : status === "ACTIVE"
        ? "RECURRENT_EXPENSE_RESUMED"
        : "RECURRENT_EXPENSE_ENDED";

  const row = await db.recurringExpense.updateMany({
    where: { id: seriesId, workspaceId },
    data: {
      status,
      pausedAt: status === "PAUSED" ? new Date() : null,
    },
  });
  if (row.count !== 1) return null;

  await writeFinancialAuditLog({
    workspaceId,
    actorUserId: userId,
    action,
    entityType: "RecurringExpense",
    entityId: seriesId,
  });

  return true;
}

export async function postponeExpenseOccurrence(
  userId: string,
  workspaceId: string,
  occurrenceId: string,
  newDueDate: Date,
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const occ = await db.recurringExpenseOccurrence.findFirst({
    where: { id: occurrenceId, workspaceId },
  });
  if (!occ || occ.status === "PAID" || occ.status === "SKIPPED") return null;

  const dueDate = civilDateToDueInstant(civilDateFromInstant(newDueDate));

  try {
    const updatedCount = await db.$transaction(async (tx) => {
      const conflict = await tx.recurringExpenseOccurrence.findFirst({
        where: {
          recurringExpenseId: occ.recurringExpenseId,
          dueDate,
          anchorDate: { not: occ.anchorDate },
        },
      });
      if (conflict) {
        if (conflict.status === "EXPECTED" || conflict.status === "POSTPONED") {
          await tx.recurringExpenseOccurrence.delete({ where: { id: conflict.id } });
        } else {
          return 0;
        }
      }
      await tx.recurringExpenseOccurrence.update({
        where: { id: occurrenceId },
        data: { dueDate, status: "POSTPONED" },
      });
      return 1;
    });
    if (updatedCount !== 1) return null;
  } catch {
    return null;
  }

  await writeFinancialAuditLog({
    workspaceId,
    actorUserId: userId,
    action: "EXPENSE_OCCURRENCE_POSTPONED",
    entityType: "RecurringExpenseOccurrence",
    entityId: occurrenceId,
  });

  return true;
}

export async function skipExpenseOccurrence(
  userId: string,
  workspaceId: string,
  occurrenceId: string,
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const updated = await db.recurringExpenseOccurrence.updateMany({
    where: {
      id: occurrenceId,
      workspaceId,
      status: { in: ["EXPECTED", "POSTPONED"] },
    },
    data: { status: "SKIPPED" },
  });
  if (updated.count !== 1) return null;

  await writeFinancialAuditLog({
    workspaceId,
    actorUserId: userId,
    action: "EXPENSE_OCCURRENCE_SKIPPED",
    entityType: "RecurringExpenseOccurrence",
    entityId: occurrenceId,
  });

  return true;
}

export async function confirmRecurringExpenseOccurrence(
  userId: string,
  workspaceId: string,
  input: {
    occurrenceId: string;
    accountId: string;
    actualAmount: string;
    paidAt: Date;
    idempotencyKey?: string;
    acknowledgeLinkedLiabilityRisk?: boolean;
  },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return { ok: false as const, reason: "forbidden" as const };

  const account = await findAccountInWorkspace(workspaceId, input.accountId);
  if (!account) return { ok: false as const, reason: "invalid_account" as const };

  const actualAmount = decimal(input.actualAmount).abs().toString();
  if (decimal(actualAmount).lte(0)) {
    return { ok: false as const, reason: "invalid_amount" as const };
  }

  const occurrence = await db.recurringExpenseOccurrence.findFirst({
    where: { id: input.occurrenceId, workspaceId },
    include: { recurringExpense: true },
  });
  if (!occurrence) {
    return { ok: false as const, reason: "not_found" as const };
  }

  const decision = canConfirmExpenseOccurrence({
    status: occurrence.status,
    transactionId: occurrence.transactionId,
  });
  if (!decision.ok) {
    return { ok: false as const, reason: decision.reason };
  }
  if (decision.alreadyConfirmed) {
    return { ok: true as const, alreadyConfirmed: true as const };
  }

  const linkedLiabilityId = occurrence.recurringExpense.linkedLiabilityId;
  if (linkedLiabilityId && !input.acknowledgeLinkedLiabilityRisk) {
    const liability = await db.financialLiability.findFirst({
      where: { id: linkedLiabilityId, workspaceId },
    });
    const recentBank = await findRecentLiabilityBankPayment(
      workspaceId,
      linkedLiabilityId,
      input.paidAt,
    );
    let message = linkedRecurringConfirmWarning(
      occurrence.recurringExpense.name,
      liability?.title ?? "passivo associado",
    );
    if (recentBank) {
      message = linkedLiabilityBankPaymentWarning(
        liability?.title ?? "passivo",
        occurrence.recurringExpense.name,
        recentBank.paidAt.toISOString().slice(0, 10),
      );
    }
    return {
      ok: false as const,
      reason: "linked_liability_ack_required" as const,
      message,
    };
  }

  if (input.idempotencyKey) {
    const existing = await db.recurringExpenseOccurrence.findFirst({
      where: { workspaceId, idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      if (
        !expenseOccurrenceConfirmMatches(
          {
            id: existing.id,
            accountId: occurrence.recurringExpense.accountId,
            actualAmount: existing.actualAmount,
          },
          { ...input, actualAmount },
        ) ||
        existing.id !== input.occurrenceId
      ) {
        return { ok: false as const, reason: "idempotency_conflict" as const };
      }
      if (existing.status === "PAID") {
        return { ok: true as const, alreadyConfirmed: true as const };
      }
    }
  }

  const amountNeg = decimal(actualAmount).negated().toString();

  try {
    const txRow = await db.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const dup = await tx.recurringExpenseOccurrence.findFirst({
          where: { workspaceId, idempotencyKey: input.idempotencyKey },
        });
        if (dup && dup.id !== input.occurrenceId) {
          throw new IdempotencyConflictError();
        }
        if (dup?.status === "PAID") {
          return dup.transactionId;
        }
      }

      const fresh = await tx.recurringExpenseOccurrence.findFirst({
        where: { id: input.occurrenceId, workspaceId },
      });
      if (!fresh || fresh.status === "PAID" || fresh.transactionId) {
        return fresh?.transactionId ?? null;
      }

      const created = await tx.transaction.create({
        data: {
          workspaceId,
          accountId: input.accountId,
          userId,
          type: "EXPENSE",
          status: "COMPLETED",
          amount: amountNeg,
          occurredAt: input.paidAt,
          description: occurrence.recurringExpense.name,
          categoryId: occurrence.recurringExpense.categoryId,
        },
      });

      const updated = await tx.recurringExpenseOccurrence.updateMany({
        where: {
          id: occurrence.id,
          workspaceId,
          status: { in: ["EXPECTED", "POSTPONED"] },
          transactionId: null,
        },
        data: {
          status: "PAID",
          actualAmount,
          paidAt: input.paidAt,
          transactionId: created.id,
          idempotencyKey: input.idempotencyKey ?? null,
        },
      });

      if (updated.count !== 1) {
        throw new Error("EXPENSE_ALREADY_PAID");
      }

      return created.id;
    });

    if (!txRow) {
      return { ok: true as const, alreadyConfirmed: true as const };
    }

    await writeFinancialAuditLog({
      workspaceId,
      actorUserId: userId,
      action: "EXPENSE_OCCURRENCE_PAID",
      entityType: "RecurringExpenseOccurrence",
      entityId: input.occurrenceId,
      metadata: { transactionId: txRow },
    });

    return { ok: true as const, alreadyConfirmed: false as const, transactionId: txRow };
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return { ok: false as const, reason: "idempotency_conflict" as const };
    }
    if (error instanceof Error && error.message === "EXPENSE_ALREADY_PAID") {
      return { ok: true as const, alreadyConfirmed: true as const };
    }
    throw error;
  }
}

export async function restoreRecurringExpenseOccurrence(
  userId: string,
  workspaceId: string,
  occurrenceId: string,
): Promise<
  | { ok: true; restoredFrom: "PAID" | "SKIPPED"; accountName: string | null }
  | { ok: false; error: string }
> {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return { ok: false, error: "Sem permissão para reverter esta ação." };

  const occurrence = await db.recurringExpenseOccurrence.findFirst({
    where: { id: occurrenceId, workspaceId, status: { in: ["PAID", "SKIPPED"] } },
    include: {
      transaction: { include: { account: { select: { name: true } } } },
    },
  });
  if (!occurrence || (occurrence.status !== "PAID" && occurrence.status !== "SKIPPED")) {
    return { ok: false, error: "Esta ocorrência já não pode ser reposta." };
  }
  if (occurrence.status === "PAID" && !occurrence.transactionId) {
    return { ok: false, error: "O pagamento não tem um movimento associado para anular." };
  }

  const restoredFrom = occurrence.status;
  const restoredStatus = occurrence.dueDate.getTime() === occurrence.anchorDate.getTime()
    ? "EXPECTED"
    : "POSTPONED";
  const now = new Date();

  const restored = await db.$transaction(async (tx) => {
    const fresh = await tx.recurringExpenseOccurrence.findFirst({
      where: { id: occurrenceId, workspaceId, status: restoredFrom },
    });
    if (!fresh) return false;

    if (restoredFrom === "PAID" && fresh.transactionId) {
      const removed = await tx.transaction.updateMany({
        where: { id: fresh.transactionId, workspaceId, deletedAt: null },
        data: { deletedAt: now },
      });
      if (removed.count !== 1) return false;
    }

    const updated = await tx.recurringExpenseOccurrence.updateMany({
      where: { id: occurrenceId, workspaceId, status: restoredFrom },
      data: {
        status: restoredStatus,
        actualAmount: null,
        paidAt: null,
        transactionId: null,
        idempotencyKey: null,
      },
    });
    return updated.count === 1;
  });

  if (!restored) return { ok: false, error: "Não foi possível reverter esta ação." };

  await writeFinancialAuditLog({
    workspaceId,
    actorUserId: userId,
    action: "EXPENSE_OCCURRENCE_PAYMENT_REVERSED",
    entityType: "RecurringExpenseOccurrence",
    entityId: occurrenceId,
    metadata: {
      restoredFrom,
      transactionId: occurrence.transactionId,
      accountName: occurrence.transaction?.account.name ?? null,
    },
  });

  return {
    ok: true,
    restoredFrom,
    accountName: occurrence.transaction?.account.name ?? null,
  };
}

/** Ocorrências futuras para integração com previsões (17b). */
export async function listPendingRecurringExpenseOccurrences(
  userId: string,
  workspaceId: string,
  until: Date,
) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  return db.recurringExpenseOccurrence.findMany({
    where: {
      workspaceId,
      status: { in: ["EXPECTED", "POSTPONED"] },
      dueDate: { lte: until },
    },
    orderBy: { dueDate: "asc" },
  });
}
