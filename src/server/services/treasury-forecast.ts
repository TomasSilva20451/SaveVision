import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { civilDateFromInstant } from "@/lib/datetime/civil-date";
import { calculateAccountBalance } from "@/lib/finance/aggregates";
import { liabilityIdsSuppressedByRecurring } from "@/lib/finance/treasury-forecast-integrity";
import {
  deduplicateTreasuryEvents,
  generateLiabilityMonthlyOutflows,
} from "@/lib/finance/treasury-liability-events";
import {
  aggregateTreasuryProjectionByMonth,
  buildTreasuryScenarioProjection,
  buildTreasuryProjection,
  groupTreasuryOutflows,
  sumStartingBalance,
  treasuryHorizonEnd,
  treasuryHorizonStart,
  TREASURY_HORIZON_DAYS,
  type TreasuryForecastEvent,
  type TreasuryHorizonDays,
} from "@/lib/finance/treasury-forecast";
import { goalProgressPercent, sumContributions } from "@/lib/finance/goal-progress";
import { decimal } from "@/lib/finance/money";
import { describeRecurringLiabilityMismatch } from "@/lib/finance/liability-recurring-link";
import { db } from "@/lib/db";
import { listWorkspaceMovements } from "@/server/repositories/ledger";

export async function collectForecastConfigurationWarnings(
  workspaceId: string,
): Promise<string[]> {
  const [recurring, liabilities] = await Promise.all([
    db.recurringExpense.findMany({
      where: { workspaceId },
      include: { linkedLiability: true },
    }),
    db.financialLiability.findMany({ where: { workspaceId } }),
  ]);

  const warnings: string[] = [];

  for (const row of recurring) {
    if (!row.linkedLiabilityId || !row.linkedLiability) continue;
    const msg = describeRecurringLiabilityMismatch({
      recurringStatus: row.status,
      recurringFrequency: row.frequency,
      recurringAmount: row.expectedAmount.toString(),
      linkedLiabilityId: row.linkedLiabilityId,
      liabilityMonthlyPayment: row.linkedLiability.monthlyPayment?.toString() ?? null,
      liabilityOutstanding: row.linkedLiability.outstandingBalance.toString(),
    });
    if (msg) warnings.push(`${row.name}: ${msg}`);
  }

  for (const liability of liabilities) {
    if (!liability.monthlyPayment) continue;
    const covered = recurring.some(
      (r) => r.linkedLiabilityId === liability.id && r.status === "ACTIVE",
    );
    if (!covered && !liability.paymentDueDayOfMonth) {
      warnings.push(
        `${liability.title}: defina o dia de vencimento para incluir esta prestação nas previsões, ou associe uma recorrência.`,
      );
    }
  }

  return warnings;
}

function parseHorizonDays(value: number | string | undefined): TreasuryHorizonDays {
  const n = Number(value);
  if (TREASURY_HORIZON_DAYS.includes(n as TreasuryHorizonDays)) {
    return n as TreasuryHorizonDays;
  }
  return 30;
}

const INCOME_SOURCE_LABELS: Record<string, string> = {
  FAMILY_TRANSFER: "Transferências familiares",
  GIFT: "Presentes",
  ECOMMERCE: "E-commerce",
  TENNIS_PRIZE: "Prémios de ténis",
  SALARY: "Salários",
  FREELANCE: "Trabalho independente",
  REFUND: "Reembolsos",
  INTEREST: "Juros",
  OTHER: "Outras receitas",
};

export async function collectTreasuryForecastEvents(
  workspaceId: string,
  horizonStart: Date,
  horizonEnd: Date,
): Promise<TreasuryForecastEvent[]> {
  const [incomeRows, expenseRows, liabilities, recurringLinks] = await Promise.all([
    db.incomeOccurrence.findMany({
      where: {
        workspaceId,
        status: "EXPECTED",
        scheduledFor: { gte: horizonStart, lte: horizonEnd },
      },
      orderBy: { scheduledFor: "asc" },
    }),
    db.recurringExpenseOccurrence.findMany({
      where: {
        workspaceId,
        status: { in: ["EXPECTED", "POSTPONED"] },
        dueDate: { gte: horizonStart, lte: horizonEnd },
      },
      include: { recurringExpense: { include: { category: true } } },
      orderBy: { dueDate: "asc" },
    }),
    db.financialLiability.findMany({
      where: { workspaceId },
    }),
    db.recurringExpense.findMany({
      where: { workspaceId },
      select: { linkedLiabilityId: true, status: true },
    }),
  ]);

  const suppressedLiabilityIds = liabilityIdsSuppressedByRecurring(recurringLinks);

  const incomeEvents: TreasuryForecastEvent[] = incomeRows.map((row) => ({
    id: row.id,
    label: row.title,
    dueDate: row.scheduledFor,
    amount: row.expectedAmount.toString(),
    direction: "inflow" as const,
    source: "INCOME_EXPECTED" as const,
    sourceRef: row.id,
    movementKind: "PREVISTO" as const,
    categoryLabel: INCOME_SOURCE_LABELS[row.sourceType] ?? "Outras receitas",
  }));

  const expenseEvents: TreasuryForecastEvent[] = expenseRows.map((row) => ({
    id: row.id,
    label: row.recurringExpense.name,
    dueDate: row.dueDate,
    amount: row.expectedAmount.toString(),
    direction: "outflow" as const,
    source: "RECURRING_EXPENSE" as const,
    sourceRef: row.recurringExpenseId,
    movementKind: "PREVISTO" as const,
    categoryLabel: row.recurringExpense.category.name,
  }));

  const liabilityEvents: TreasuryForecastEvent[] = [];
  for (const row of liabilities) {
    if (row.monthlyPayment == null) continue;
    if (suppressedLiabilityIds.has(row.id)) continue;
    const anchor = civilDateFromInstant(row.createdAt);
    liabilityEvents.push(
      ...generateLiabilityMonthlyOutflows({
        liabilityId: row.id,
        title: row.title,
        monthlyPayment: row.monthlyPayment.toString(),
        outstandingBalance: row.outstandingBalance.toString(),
        scheduleAnchor: anchor,
        paymentDueDayOfMonth: row.paymentDueDayOfMonth,
        horizonStart,
        horizonEnd,
      }),
    );
  }

  return deduplicateTreasuryEvents([...incomeEvents, ...expenseEvents, ...liabilityEvents]);
}

type TreasuryContext = {
  startingBalance: string;
  eventsMaxHorizon: TreasuryForecastEvent[];
  asOf: Date;
};

export async function loadTreasuryContext(
  userId: string,
  workspaceId: string,
): Promise<TreasuryContext | null> {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const asOf = new Date();
  const horizonStart = treasuryHorizonStart(asOf);
  const horizonEnd = treasuryHorizonEnd(asOf, 365);

  const [accounts, movements, eventsMaxHorizon] = await Promise.all([
    db.financialAccount.findMany({
      where: { workspaceId, isArchived: false },
    }),
    listWorkspaceMovements(workspaceId),
    collectTreasuryForecastEvents(workspaceId, horizonStart, horizonEnd),
  ]);

  const balances = accounts.map((account) =>
    calculateAccountBalance(
      account.openingBalance.toString(),
      movements,
      account.id,
    ).toFixed(2),
  );

  return {
    startingBalance: sumStartingBalance(balances),
    eventsMaxHorizon,
    asOf,
  };
}

export async function getTreasuryForecast(
  userId: string,
  workspaceId: string,
  horizonInput?: number,
) {
  const context = await loadTreasuryContext(userId, workspaceId);
  if (!context) return null;

  const horizonDays = parseHorizonDays(horizonInput);
  const [projection, configurationWarnings] = await Promise.all([
    Promise.resolve(
      buildTreasuryProjection({
        startingBalance: context.startingBalance,
        events: context.eventsMaxHorizon,
        horizonDays,
        asOf: context.asOf,
      }),
    ),
    collectForecastConfigurationWarnings(workspaceId),
  ]);

  return {
    horizonDays,
    realBalance: context.startingBalance,
    projection,
    labels: {
      realBalance: "Saldo real (contas)",
      projectedBalance: "Saldo projetado",
      inflows: "Entradas previstas",
      outflows: "Saídas previstas",
      projectionTitle: "Projeção com movimentos conhecidos",
      limitationNotice:
        "Esta projeção considera os movimentos futuros conhecidos e registados no FinTwin. " +
        "Não representa uma garantia do saldo futuro.",
      economicNote:
        "Valores previstos não alteram saldos reais até confirmação ou receção.",
    },
    sourcesIncluded: [
      "Receitas com estado EXPECTED",
      "Despesas recorrentes EXPECTED ou POSTPONED",
      "Prestações mensais de passivos com monthlyPayment registado",
    ],
    configurationWarnings,
    sourcesExcluded: [
      "Ocorrências PAID, SKIPPED, RECEIVED, MISSED ou CANCELLED",
      "Transferências internas (já líquidas no saldo agregado)",
      "Passivos ligados a despesa recorrente (fonte autoritativa: recorrência)",
      "Passivos sem paymentDueDayOfMonth (sem data de vencimento fiável)",
    ],
  };
}

export async function getTreasuryForecastAllHorizons(userId: string, workspaceId: string) {
  const context = await loadTreasuryContext(userId, workspaceId);
  if (!context) return null;

  return TREASURY_HORIZON_DAYS.map((days) => {
    const projection = buildTreasuryProjection({
      startingBalance: context.startingBalance,
      events: context.eventsMaxHorizon,
      horizonDays: days,
      asOf: context.asOf,
    });
    return {
      horizonDays: days,
      projectedBalance: projection.projectedBalance,
      netExpected: projection.netExpected,
    };
  });
}

export async function getTreasuryForecastDashboard(
  userId: string,
  workspaceId: string,
  horizonInput?: number,
) {
  const context = await loadTreasuryContext(userId, workspaceId);
  if (!context) return null;

  const horizonDays = parseHorizonDays(horizonInput);
  const base = buildTreasuryProjection({
    startingBalance: context.startingBalance,
    events: context.eventsMaxHorizon,
    horizonDays,
    asOf: context.asOf,
  });
  const optimistic = buildTreasuryScenarioProjection({
    startingBalance: context.startingBalance,
    events: context.eventsMaxHorizon,
    horizonDays,
    asOf: context.asOf,
    assumptions: { incomePercentChange: "10", recurringExpensePercentChange: "-5" },
  });
  const pessimistic = buildTreasuryScenarioProjection({
    startingBalance: context.startingBalance,
    events: context.eventsMaxHorizon,
    horizonDays,
    asOf: context.asOf,
    assumptions: { incomePercentChange: "-10", recurringExpensePercentChange: "10" },
  });

  const [configurationWarnings, goals] = await Promise.all([
    collectForecastConfigurationWarnings(workspaceId),
    db.savingsGoal.findMany({
      where: { workspaceId, archived: false },
      include: { contributions: true },
      orderBy: { createdAt: "asc" },
      take: 4,
    }),
  ]);

  const goalRows = goals.map((goal) => {
    const currentAmount = sumContributions(
      goal.contributions.map((row) => row.amount.toString()),
    ).toFixed(2);
    return {
      id: goal.id,
      title: goal.title,
      kind: goal.kind,
      targetAmount: goal.targetAmount.toString(),
      currentAmount,
      progressPercent: goalProgressPercent(currentAmount, goal.targetAmount.toString()) ?? 0,
      targetDate: goal.targetDate?.toISOString() ?? null,
    };
  });

  const distribution = groupTreasuryOutflows(base.events);
  const minBalance = base.timeline.reduce(
    (minimum, point) =>
      decimal(point.projectedBalance).lt(minimum) ? decimal(point.projectedBalance) : minimum,
    decimal(base.startingBalance),
  );
  const insights: { id: string; tone: "info" | "warning" | "success"; title: string; description: string }[] = [];
  if (minBalance.lt(0)) {
    insights.push({
      id: "negative-balance",
      tone: "warning",
      title: "Risco de saldo negativo",
      description: `A projeção base atinge um mínimo de ${minBalance.toFixed(2)} € no horizonte selecionado.`,
    });
  } else if (base.events.length === 0) {
    insights.push({
      id: "stable-balance",
      tone: "info",
      title: "Sem movimentos conhecidos",
      description: "O saldo mantém-se estável porque não existem entradas ou saídas previstas neste horizonte.",
    });
  } else {
    insights.push({
      id: "positive-liquidity",
      tone: "success",
      title: "Tesouraria positiva no cenário base",
      description: `O saldo mínimo projetado é ${minBalance.toFixed(2)} € com os movimentos atualmente conhecidos.`,
    });
  }
  if (distribution[0]) {
    insights.push({
      id: "outflow-concentration",
      tone: "info",
      title: "Principal fonte de saídas",
      description: `${distribution[0].label} representa ${distribution[0].percent.toLocaleString("pt-PT")} % das saídas projetadas.`,
    });
  }
  if (configurationWarnings[0]) {
    insights.push({
      id: "configuration-warning",
      tone: "warning",
      title: "Configuração incompleta",
      description: configurationWarnings[0],
    });
  }

  return {
    horizonDays,
    asOf: context.asOf.toISOString(),
    realBalance: context.startingBalance,
    base,
    scenarios: {
      optimistic: {
        projection: optimistic,
        assumptions: "Receitas previstas +10%; recorrências elegíveis −5%; prestações fixas inalteradas.",
      },
      pessimistic: {
        projection: pessimistic,
        assumptions: "Receitas previstas −10%; recorrências elegíveis +10%; prestações fixas inalteradas.",
      },
    },
    monthlyFlows: aggregateTreasuryProjectionByMonth(base),
    optimisticMonthlyFlows: aggregateTreasuryProjectionByMonth(optimistic),
    pessimisticMonthlyFlows: aggregateTreasuryProjectionByMonth(pessimistic),
    outflowDistribution: distribution,
    goals: goalRows,
    insights: insights.slice(0, 3),
    configurationWarnings,
    sourcesIncluded: [
      "Receitas EXPECTED",
      "Recorrências EXPECTED ou POSTPONED",
      "Prestações com montante e vencimento conhecidos",
    ],
    sourcesExcluded: [
      "Ocorrências PAID, SKIPPED, RECEIVED, MISSED ou CANCELLED",
      "Passivos sem dia de vencimento",
      "Passivos já representados por uma recorrência ativa",
    ],
  };
}
