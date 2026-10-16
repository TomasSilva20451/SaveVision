import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { calculateAccountBalance } from "@/lib/finance/aggregates";
import { civilDateFromInstant, isInstantInCivilMonth } from "@/lib/datetime/civil-date";
import { minProjectedBalanceInTimeline } from "@/lib/finance/financial-alerts";
import { decimal } from "@/lib/finance/money";
import {
  buildTreasuryProjection,
  treasuryHorizonStart,
  TREASURY_HORIZON_DAYS,
} from "@/lib/finance/treasury-forecast";
import { db } from "@/lib/db";
import { listWorkspaceMovements } from "@/server/repositories/ledger";
import { getPlanningOverview } from "@/server/services/planning";
import { loadTreasuryContext } from "@/server/services/treasury-forecast";

export type SimulationLiabilityRow = {
  id: string;
  title: string;
  outstandingBalance: string;
  monthlyPayment: string | null;
  manualRatePercent: string | null;
  paymentDueDayOfMonth: number | null;
};

/** Dados de referência autorizados — somente leitura; nunca altera a BD. */
export async function getSimulationBaseline(userId: string, workspaceId: string) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const civil = civilDateFromInstant(new Date());
  const asOf = new Date();

  const [accounts, movements, transactions, planning, liabilities, treasuryContext] =
    await Promise.all([
      db.financialAccount.findMany({ where: { workspaceId, isArchived: false } }),
      listWorkspaceMovements(workspaceId),
      db.transaction.findMany({
        where: { workspaceId, deletedAt: null, status: "COMPLETED" },
      }),
      getPlanningOverview(userId, workspaceId),
      db.financialLiability.findMany({ where: { workspaceId }, orderBy: { title: "asc" } }),
      loadTreasuryContext(userId, workspaceId),
    ]);

  const totalBalance = accounts
    .map((a) =>
      calculateAccountBalance(a.openingBalance.toString(), movements, a.id).toFixed(2),
    )
    .reduce((s, v) => s.plus(v), decimal(0))
    .toFixed(2);

  const incomeMonth = transactions
    .filter(
      (t) =>
        t.type === "INCOME" && isInstantInCivilMonth(t.occurredAt, civil.year, civil.month),
    )
    .reduce((s, t) => s.plus(t.amount.toString()), decimal(0))
    .toFixed(2);

  const expenseMonth = transactions
    .filter(
      (t) =>
        t.type === "EXPENSE" && isInstantInCivilMonth(t.occurredAt, civil.year, civil.month),
    )
    .reduce((s, t) => s.plus(decimal(t.amount.toString()).abs()), decimal(0))
    .toFixed(2);

  let treasuryMin30: string | null = null;
  let treasuryMinDate30: string | null = null;
  let treasuryEventsJson: { count: number } = { count: 0 };

  if (treasuryContext) {
    const projection = buildTreasuryProjection({
      startingBalance: treasuryContext.startingBalance,
      events: treasuryContext.eventsMaxHorizon,
      horizonDays: 30,
      asOf: treasuryContext.asOf,
    });
    const minInfo = minProjectedBalanceInTimeline(projection.timeline);
    treasuryMin30 = minInfo?.minBalance ?? projection.projectedBalance;
    treasuryMinDate30 = minInfo?.civilDate ?? null;
    treasuryEventsJson = { count: projection.events.length };
  }

  const liabilityRows: SimulationLiabilityRow[] = liabilities.map((l) => ({
    id: l.id,
    title: l.title,
    outstandingBalance: l.outstandingBalance.toString(),
    monthlyPayment: l.monthlyPayment?.toString() ?? null,
    manualRatePercent: l.manualRatePercent?.toString() ?? null,
    paymentDueDayOfMonth: l.paymentDueDayOfMonth,
  }));

  return {
    workspaceId,
    asOfCivil: `${civil.year}-${String(civil.month).padStart(2, "0")}`,
    asOfInstant: asOf.toISOString(),
    aggregateBalance: totalBalance,
    monthlyIncomeObserved: incomeMonth,
    monthlyExpenseObserved: expenseMonth,
    savingsBalance: planning?.dashboardKpis.savingsBalance ?? "0.00",
    emergencyTarget: planning?.emergencyTarget ?? null,
    monthlyEssential: planning?.monthlyEssential ?? expenseMonth,
    emergencyTargetMonths: planning?.settings.emergencyFundTargetMonths ?? 6,
    liabilities: liabilityRows,
    treasury: treasuryContext
      ? {
          startingBalance: treasuryContext.startingBalance,
          horizonStart: treasuryHorizonStart(treasuryContext.asOf).toISOString(),
          knownEventCount: treasuryEventsJson.count,
          minProjectedBalance30: treasuryMin30,
          minProjectedDate30: treasuryMinDate30,
          horizonsSupported: [...TREASURY_HORIZON_DAYS],
        }
      : null,
    disclaimer:
      "Cenário BASE com base nos dados conhecidos do workspace. Simulações não alteram contas, passivos ou transações.",
  };
}
