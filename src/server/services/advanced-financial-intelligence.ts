import "server-only";

import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { civilDateFromInstant, startOfCivilMonth } from "@/lib/datetime/civil-date";
import { calculateCashFlow } from "@/lib/finance/aggregates";
import { treasuryHorizonEnd, treasuryHorizonStart } from "@/lib/finance/treasury-forecast";
import { sumContributions } from "@/lib/finance/goal-progress";
import { decimal } from "@/lib/finance/money";
import type { LedgerMovement } from "@/lib/finance/types";
import {
  assessLiquidityRisk,
  explainableSavingsRecommendation,
  forecastCashBalanceDistribution,
} from "@/lib/ml/probabilistic-forecast";
import { db } from "@/lib/db";
import { listAccountsWithBalances } from "@/server/services/accounts";
import { collectTreasuryForecastEvents } from "@/server/services/treasury-forecast";

function monthRefs(count: number): Array<{ year: number; month: number; key: string }> {
  const today = civilDateFromInstant(new Date());
  const refs = [];
  let year = today.year;
  let month = today.month;
  for (let offset = 0; offset < count; offset += 1) {
    refs.unshift({ year, month, key: `${year}-${String(month).padStart(2, "0")}` });
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return refs;
}

function toMovement(tx: { accountId: string; type: string; status: string; amount: { toString(): string }; deletedAt: Date | null }): LedgerMovement {
  return {
    accountId: tx.accountId,
    type: tx.type as LedgerMovement["type"],
    status: tx.status as LedgerMovement["status"],
    amount: tx.amount.toString(),
    deletedAt: tx.deletedAt,
  };
}

export async function getAdvancedFinancialIntelligence(userId: string, workspaceId: string) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const months = monthRefs(12);
  const from = startOfCivilMonth(months[0]!.year, months[0]!.month);
  const now = new Date();
  const [transactions, accounts, events, goal] = await Promise.all([
    db.transaction.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        status: "COMPLETED",
        type: { in: ["INCOME", "EXPENSE"] },
        occurredAt: { gte: from },
      },
      orderBy: { occurredAt: "asc" },
    }),
    listAccountsWithBalances(userId, workspaceId),
    collectTreasuryForecastEvents(
      workspaceId,
      treasuryHorizonStart(now),
      treasuryHorizonEnd(now, 30),
    ),
    db.savingsGoal.findFirst({
      where: { workspaceId, archived: false, kind: "EMERGENCY_FUND" },
      include: { contributions: true },
    }),
  ]);
  if (!accounts || !events) return null;

  const monthlyNetFlows = months.map((ref) => {
    const movements = transactions.filter((tx) => {
      const civil = civilDateFromInstant(tx.occurredAt);
      return civil.year === ref.year && civil.month === ref.month;
    });
    return calculateCashFlow(movements.map(toMovement)).toFixed(2);
  });
  const currentBalance = accounts
    .filter((account) => account.type !== "LIABILITY")
    .reduce((sum, account) => sum.plus(account.currentBalance), decimal(0))
    .toFixed(2);
  const forecast = forecastCashBalanceDistribution({
    currentBalance,
    monthlyNetFlows,
    horizonMonths: 6,
  });
  const in30Days = new Date(Date.now() + 30 * 86_400_000);
  const next30DaysKnownOutflows = events
    .filter((event) => event.dueDate <= in30Days && decimal(event.amount).lt(0))
    .reduce((sum, event) => sum.plus(decimal(event.amount).abs()), decimal(0))
    .toFixed(2);
  const liquidityRisk = assessLiquidityRisk({ forecast, currentBalance, next30DaysKnownOutflows });
  const emergencyFundCurrent = goal
    ? sumContributions(goal.contributions.map((row) => row.amount.toString())).toFixed(2)
    : "0.00";
  const emergencyGapRaw = goal
    ? decimal(goal.targetAmount.toString()).minus(emergencyFundCurrent)
    : decimal(0);
  const emergencyFundGap = emergencyGapRaw.lt(0) ? "0.00" : emergencyGapRaw.toFixed(2);
  const savingsRecommendation = explainableSavingsRecommendation({
    forecast,
    liquidityRisk,
    emergencyFundGap,
  });

  return {
    currentBalance,
    monthLabels: months.map((month) => month.key),
    monthlyNetFlows,
    forecast,
    liquidityRisk,
    savingsRecommendation,
    next30DaysKnownOutflows,
    emergencyFundGap,
    safeguards: {
      readOnly: true,
      createsTransactions: false,
      requiresHumanConfirmation: true,
    },
  };
}
