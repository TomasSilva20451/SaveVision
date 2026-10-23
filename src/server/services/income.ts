import {
  requireWorkspaceAccess,
  requireWorkspaceEditor,
} from "@/lib/auth/workspace-access";
import { canConfirmOccurrence } from "@/lib/finance/income-occurrence";
import { calculateEcommerceNetProceeds } from "@/lib/finance/ecommerce";
import { calculateTennisNetPrize } from "@/lib/finance/tennis";
import { db } from "@/lib/db";
import { writeFinancialAuditLog } from "@/server/audit/financial-audit";
import {
  findAccountInWorkspace,
  findCategoryInWorkspace,
} from "@/server/repositories/account-guard";
import {
  civilDateFromInstant,
  startOfCivilMonth,
  startOfNextCivilMonth,
} from "@/lib/datetime/civil-date";
import { decimal } from "@/lib/finance/money";
import {
  rememberTransactionCategorizationDecision,
  type CategorizationDecision,
} from "@/server/services/transaction-categorization-rules";
import { appendAuditEvent } from "@/server/audit/audit-ledger";
import { observeTransactionPersisted } from "@/lib/observability/finance-events";

export async function createOneOffIncome(
  userId: string,
  workspaceId: string,
  input: {
    accountId: string;
    amount: string;
    description: string;
    occurredAt: Date;
    status: "COMPLETED" | "EXPECTED";
    sourceType: "SALARY" | "FREELANCE" | "GIFT" | "OTHER";
    categoryId?: string;
    categorization?: CategorizationDecision;
  },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const account = await findAccountInWorkspace(workspaceId, input.accountId);
  if (!account) return null;

  if (input.categoryId) {
    const category = await findCategoryInWorkspace(workspaceId, input.categoryId);
    if (!category) return null;
  }

  const amount = decimal(input.amount).abs().toString();

  const transaction = await db.transaction.create({
    data: {
      workspaceId,
      accountId: account.id,
      userId,
      type: "INCOME",
      status: input.status,
      amount,
      occurredAt: input.occurredAt,
      description: input.description,
      categoryId: input.categoryId,
    },
  });

  observeTransactionPersisted("income");

  await rememberTransactionCategorizationDecision({
    userId,
    workspaceId,
    description: input.description,
    transactionType: "INCOME",
    selectedCategoryId: input.categoryId,
    decision: input.categorization,
  });

  await writeFinancialAuditLog({
    workspaceId,
    actorUserId: userId,
    action: "TRANSACTION_CREATED",
    entityType: "Transaction",
    entityId: transaction.id,
    metadata: { type: "INCOME", status: input.status, accountId: input.accountId },
  });

  return transaction;
}

export async function createFamilyIncomeSeries(
  userId: string,
  workspaceId: string,
  input: {
    accountId: string;
    familyOrigin: string;
    amount: string;
    frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
    nextDueAt: Date;
    certainty: "HIGH" | "MEDIUM" | "LOW";
    endAt?: Date;
  },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const account = await findAccountInWorkspace(workspaceId, input.accountId);
  if (!account) return null;

  const amount = decimal(input.amount).abs().toString();

  const series = await db.$transaction(async (tx) => {
    const series = await tx.incomeSeries.create({
      data: {
        workspaceId,
        userId,
        sourceType: "FAMILY_TRANSFER",
        title: `Transferência familiar · ${input.familyOrigin}`,
        amount,
        frequency: input.frequency,
        accountId: input.accountId,
        familyOrigin: input.familyOrigin,
        certainty: input.certainty,
        nextDueAt: input.nextDueAt,
        endAt: input.endAt,
      },
    });

    await tx.incomeOccurrence.create({
      data: {
        workspaceId,
        userId,
        seriesId: series.id,
        sourceType: "FAMILY_TRANSFER",
        status: "EXPECTED",
        expectedAmount: amount,
        scheduledFor: input.nextDueAt,
        accountId: input.accountId,
        title: series.title,
      },
    });

    return series;
  });
  await appendAuditEvent({
    actorUserId: userId,
    workspaceId,
    action: "INCOME_SERIES_CREATED",
    resourceType: "IncomeSeries",
    resourceId: series.id,
    outcome: "SUCCESS",
    source: "financial-service",
  });
  return series;
}

export async function confirmIncomeOccurrence(
  userId: string,
  workspaceId: string,
  occurrenceId: string,
  receivedAt: Date,
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return { ok: false as const, reason: "forbidden" as const };

  const occurrence = await db.incomeOccurrence.findFirst({
    where: { id: occurrenceId, workspaceId },
  });

  if (!occurrence) {
    return { ok: false as const, reason: "not_found" as const };
  }

  const decision = canConfirmOccurrence({
    status: occurrence.status,
    transactionId: occurrence.transactionId,
  });

  if (!decision.ok) {
    return { ok: false as const, reason: decision.reason };
  }

  if (decision.alreadyConfirmed) {
    return { ok: true as const, alreadyConfirmed: true as const };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const txRow = await tx.transaction.create({
        data: {
          workspaceId,
          accountId: occurrence.accountId,
          userId,
          type: "INCOME",
          status: "COMPLETED",
          amount: occurrence.expectedAmount.toString(),
          occurredAt: receivedAt,
          description: occurrence.title,
        },
      });

      const updated = await tx.incomeOccurrence.updateMany({
        where: {
          id: occurrence.id,
          workspaceId,
          status: "EXPECTED",
          transactionId: null,
        },
        data: {
          status: "RECEIVED",
          transactionId: txRow.id,
        },
      });

      if (updated.count !== 1) {
        throw new Error("INCOME_ALREADY_CONFIRMED");
      }

      return txRow;
    });

    await writeFinancialAuditLog({
      workspaceId,
      actorUserId: userId,
      action: "INCOME_CONFIRMED",
      entityType: "IncomeOccurrence",
      entityId: occurrenceId,
      metadata: { transactionId: result.id },
    });

    return { ok: true as const, alreadyConfirmed: false as const, transaction: result };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "INCOME_ALREADY_CONFIRMED"
    ) {
      return { ok: true as const, alreadyConfirmed: true as const };
    }
    throw error;
  }
}

export async function createEcommerceSaleRecord(
  userId: string,
  workspaceId: string,
  input: {
    accountId: string;
    marketplace?: string;
    orderReference?: string;
    grossAmount: string;
    marketplaceFees?: string;
    paymentFees?: string;
    shippingCost?: string;
    costOfGoods?: string;
    otherCosts?: string;
    taxReservePercentage?: string;
    saleDate: Date;
    recordPayout: boolean;
  },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const account = await findAccountInWorkspace(workspaceId, input.accountId);
  if (!account) return null;

  const { netProceeds, taxReserveAmount } = calculateEcommerceNetProceeds(input);

  const sale = await db.$transaction(async (tx) => {
    let transactionId: string | undefined;

    if (input.recordPayout) {
      const movement = await tx.transaction.create({
        data: {
          workspaceId,
          accountId: input.accountId,
          userId,
          type: "INCOME",
          status: "COMPLETED",
          amount: netProceeds.toString(),
          occurredAt: input.saleDate,
          description: `Venda e-commerce${input.orderReference ? ` · ${input.orderReference}` : ""}`,
        },
      });
      transactionId = movement.id;
    }

    return tx.ecommerceSale.create({
      data: {
        workspaceId,
        userId,
        accountId: input.accountId,
        marketplace: input.marketplace,
        orderReference: input.orderReference,
        grossAmount: input.grossAmount,
        marketplaceFees: input.marketplaceFees ?? 0,
        paymentFees: input.paymentFees ?? 0,
        shippingCost: input.shippingCost ?? 0,
        costOfGoods: input.costOfGoods ?? 0,
        otherCosts: input.otherCosts ?? 0,
        netProceeds: netProceeds.toString(),
        taxReservePercentage: input.taxReservePercentage ?? 0,
        taxReserveAmount: taxReserveAmount.toString(),
        saleDate: input.saleDate,
        payoutDate: input.recordPayout ? input.saleDate : null,
        transactionId,
      },
    });
  });
  await appendAuditEvent({
    actorUserId: userId,
    workspaceId,
    action: "ECOMMERCE_SALE_CREATED",
    resourceType: "EcommerceSale",
    resourceId: sale.id,
    outcome: "SUCCESS",
    source: "financial-service",
    metadata: { payoutRecorded: Boolean(sale.transactionId) },
  });
  return sale;
}

export async function createTournamentIncomeRecord(
  userId: string,
  workspaceId: string,
  input: {
    accountId: string;
    tournamentName: string;
    tournamentDate: Date;
    location?: string;
    grossPrize: string;
    registrationFee?: string;
    travelCost?: string;
    accommodationCost?: string;
    foodCost?: string;
    otherCosts?: string;
    recordPayout: boolean;
  },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const account = await findAccountInWorkspace(workspaceId, input.accountId);
  if (!account) return null;

  const netPrize = calculateTennisNetPrize(input);

  const tournament = await db.$transaction(async (tx) => {
    let transactionId: string | undefined;

    if (input.recordPayout && netPrize.greaterThan(0)) {
      const movement = await tx.transaction.create({
        data: {
          workspaceId,
          accountId: input.accountId,
          userId,
          type: "INCOME",
          status: "COMPLETED",
          amount: netPrize.toString(),
          occurredAt: input.tournamentDate,
          description: `Torneio · ${input.tournamentName}`,
        },
      });
      transactionId = movement.id;
    }

    return tx.tournamentIncome.create({
      data: {
        workspaceId,
        userId,
        accountId: input.accountId,
        tournamentName: input.tournamentName,
        tournamentDate: input.tournamentDate,
        location: input.location,
        grossPrize: input.grossPrize,
        registrationFee: input.registrationFee ?? 0,
        travelCost: input.travelCost ?? 0,
        accommodationCost: input.accommodationCost ?? 0,
        foodCost: input.foodCost ?? 0,
        otherCosts: input.otherCosts ?? 0,
        netPrize: netPrize.toString(),
        transactionId,
      },
    });
  });
  await appendAuditEvent({
    actorUserId: userId,
    workspaceId,
    action: "TOURNAMENT_INCOME_CREATED",
    resourceType: "TournamentIncome",
    resourceId: tournament.id,
    outcome: "SUCCESS",
    source: "financial-service",
    metadata: { payoutRecorded: Boolean(tournament.transactionId) },
  });
  return tournament;
}

const SOURCE_LABELS: Record<string, string> = {
  FAMILY_TRANSFER: "Transferências familiares",
  GIFT: "Presentes",
  ECOMMERCE: "E-commerce",
  TENNIS_PRIZE: "Prémios de ténis",
  SALARY: "Salários",
  FREELANCE: "Trabalho independente",
  REFUND: "Reembolsos",
  INTEREST: "Juros",
  OTHER: "Outras",
};

const FREQUENCY_LABELS: Record<string, string> = {
  WEEKLY: "Semanal",
  BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  YEARLY: "Anual",
  CUSTOM: "Personalizada",
  ONE_OFF: "Pontual",
};

function shiftMonth(year: number, month: number, offset: number) {
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function inMonth(date: Date, year: number, month: number) {
  const civil = civilDateFromInstant(date);
  return civil.year === year && civil.month === month;
}

export async function listIncomeOverview(
  userId: string,
  workspaceId: string,
  year: number,
  month: number,
) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const evolutionStart = shiftMonth(year, month, -5);
  const queryStart = startOfCivilMonth(year - 1, month);
  const queryEnd = startOfNextCivilMonth(year, month);

  const [transactions, occurrences, upcoming, series] = await Promise.all([
    db.transaction.findMany({
      where: {
        workspaceId,
        type: "INCOME",
        deletedAt: null,
        occurredAt: { gte: queryStart, lt: queryEnd },
      },
      include: {
        category: { select: { name: true } },
        incomeOccurrence: { select: { sourceType: true } },
        ecommerceSale: { select: { id: true } },
        tournamentIncome: { select: { id: true } },
      },
      orderBy: { occurredAt: "desc" },
    }),
    db.incomeOccurrence.findMany({
      where: {
        workspaceId,
        scheduledFor: {
          gte: startOfCivilMonth(evolutionStart.year, evolutionStart.month),
          lt: queryEnd,
        },
      },
      include: { series: { select: { frequency: true } } },
      orderBy: { scheduledFor: "desc" },
    }),
    db.incomeOccurrence.findMany({
      where: { workspaceId, status: "EXPECTED", scheduledFor: { gte: new Date() } },
      orderBy: { scheduledFor: "asc" },
      take: 6,
    }),
    db.incomeSeries.findMany({
      where: { workspaceId },
      include: {
        occurrences: { orderBy: { scheduledFor: "desc" }, take: 12 },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const sourceForTransaction = (transaction: (typeof transactions)[number]) => {
    if (transaction.incomeOccurrence) return transaction.incomeOccurrence.sourceType;
    if (transaction.ecommerceSale) return "ECOMMERCE";
    if (transaction.tournamentIncome) return "TENNIS_PRIZE";
    return "OTHER";
  };

  const completedFor = (targetYear: number, targetMonth: number) =>
    transactions.filter(
      (transaction) =>
        transaction.status === "COMPLETED" &&
        inMonth(transaction.occurredAt, targetYear, targetMonth),
    );
  const expectedTransactionsFor = (targetYear: number, targetMonth: number) =>
    transactions.filter(
      (transaction) =>
        transaction.status === "EXPECTED" &&
        inMonth(transaction.occurredAt, targetYear, targetMonth),
    );
  const expectedOccurrencesFor = (targetYear: number, targetMonth: number) =>
    occurrences.filter(
      (occurrence) =>
        occurrence.status === "EXPECTED" &&
        inMonth(occurrence.scheduledFor, targetYear, targetMonth),
    );

  const completed = completedFor(year, month);
  const expectedTransactions = expectedTransactionsFor(year, month);
  const expectedOccurrences = expectedOccurrencesFor(year, month);
  const confirmedTotal = completed.reduce(
    (sum, transaction) => sum.plus(transaction.amount.toString()),
    decimal(0),
  );
  const expectedTotal = expectedTransactions
    .reduce((sum, transaction) => sum.plus(transaction.amount.toString()), decimal(0))
    .plus(
      expectedOccurrences.reduce(
        (sum, occurrence) => sum.plus(occurrence.expectedAmount.toString()),
        decimal(0),
      ),
    );
  const total = confirmedTotal.plus(expectedTotal);
  const previousYearTotal = completedFor(year - 1, month).reduce(
    (sum, transaction) => sum.plus(transaction.amount.toString()),
    decimal(0),
  );
  const annualDifference = confirmedTotal.minus(previousYearTotal);
  const annualPercent = previousYearTotal.isZero()
    ? null
    : annualDifference.div(previousYearTotal).times(100).toDecimalPlaces(1).toString();

  const distribution = new Map<string, ReturnType<typeof decimal>>();
  const addDistribution = (source: string, amount: string) => {
    distribution.set(source, (distribution.get(source) ?? decimal(0)).plus(amount));
  };
  completed.forEach((transaction) =>
    addDistribution(sourceForTransaction(transaction), transaction.amount.toString()),
  );
  expectedTransactions.forEach((transaction) =>
    addDistribution(sourceForTransaction(transaction), transaction.amount.toString()),
  );
  expectedOccurrences.forEach((occurrence) =>
    addDistribution(occurrence.sourceType, occurrence.expectedAmount.toString()),
  );

  const evolution = Array.from({ length: 6 }, (_, index) => {
    const period = shiftMonth(year, month, index - 5);
    const confirmedValue = completedFor(period.year, period.month).reduce(
      (sum, transaction) => sum.plus(transaction.amount.toString()),
      decimal(0),
    );
    const expectedValue = expectedTransactionsFor(period.year, period.month)
      .reduce((sum, transaction) => sum.plus(transaction.amount.toString()), decimal(0))
      .plus(
        expectedOccurrencesFor(period.year, period.month).reduce(
          (sum, occurrence) => sum.plus(occurrence.expectedAmount.toString()),
          decimal(0),
        ),
      );
    const label = new Intl.DateTimeFormat("pt-PT", {
      month: "short",
      timeZone: "Europe/Lisbon",
    })
      .format(startOfCivilMonth(period.year, period.month))
      .replace(".", "");
    return {
      label: label.charAt(0).toUpperCase() + label.slice(1),
      confirmed: confirmedValue.toNumber(),
      expected: expectedValue.toNumber(),
    };
  });

  const seriesRows = series.map((incomeSeries) => {
    const occurrence =
      incomeSeries.occurrences
        .filter((item) => item.status === "EXPECTED")
        .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())[0] ??
      incomeSeries.occurrences[0] ??
      null;
    return {
      id: `series-${incomeSeries.id}`,
      title: incomeSeries.title,
      sourceType: incomeSeries.sourceType,
      sourceLabel: SOURCE_LABELS[incomeSeries.sourceType],
      amount: incomeSeries.amount.toString(),
      frequency: FREQUENCY_LABELS[incomeSeries.frequency] ?? incomeSeries.frequency,
      nextDate: occurrence?.scheduledFor ?? incomeSeries.nextDueAt,
      status: occurrence?.status ?? (incomeSeries.active ? "EXPECTED" : "CANCELLED"),
      occurrenceId: occurrence?.status === "EXPECTED" ? occurrence.id : null,
    };
  });
  const transactionRows = transactions
    .filter((transaction) => inMonth(transaction.occurredAt, year, month) && !transaction.incomeOccurrence)
    .map((transaction) => {
      const sourceType = sourceForTransaction(transaction);
      return {
        id: `transaction-${transaction.id}`,
        title: transaction.description || "Receita sem descrição",
        sourceType,
        sourceLabel: transaction.category?.name ?? SOURCE_LABELS[sourceType],
        amount: transaction.amount.toString(),
        frequency: "Pontual",
        nextDate: transaction.occurredAt,
        status: transaction.status === "COMPLETED" ? "RECEIVED" : transaction.status,
        occurrenceId: null,
      };
    });

  return {
    summary: {
      total: total.toString(),
      confirmed: confirmedTotal.toString(),
      expected: expectedTotal.toString(),
      confirmedShare: total.isZero() ? "0" : confirmedTotal.div(total).times(100).toDecimalPlaces(1).toString(),
      expectedShare: total.isZero() ? "0" : expectedTotal.div(total).times(100).toDecimalPlaces(1).toString(),
      annualDifference: annualDifference.toString(),
      annualPercent,
      hasAnnualComparison: !previousYearTotal.isZero(),
    },
    evolution,
    distribution: [...distribution.entries()]
      .map(([sourceType, amount]) => ({
        sourceType,
        name: SOURCE_LABELS[sourceType] ?? sourceType,
        value: amount.toString(),
      }))
      .sort((a, b) => decimal(b.value).comparedTo(a.value)),
    sources: [...seriesRows, ...transactionRows],
    upcoming: upcoming.map((occurrence) => ({
      id: occurrence.id,
      title: occurrence.title,
      sourceType: occurrence.sourceType,
      amount: occurrence.expectedAmount.toString(),
      scheduledFor: occurrence.scheduledFor,
    })),
  };
}
