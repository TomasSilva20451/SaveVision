import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { civilDateFromInstant } from "@/lib/datetime/civil-date";
import { calculateAccountBalance } from "@/lib/finance/aggregates";
import { liabilityIdsSuppressedByRecurring } from "@/lib/finance/treasury-forecast-integrity";
import {
  deduplicateTreasuryEvents,
  generateLiabilityMonthlyOutflows,
} from "@/lib/finance/treasury-liability-events";
import {
  buildTreasuryProjection,
  sumStartingBalance,
  treasuryHorizonEnd,
  treasuryHorizonStart,
  TREASURY_HORIZON_DAYS,
  type TreasuryForecastEvent,
  type TreasuryHorizonDays,
} from "@/lib/finance/treasury-forecast";
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
      include: { recurringExpense: true },
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
