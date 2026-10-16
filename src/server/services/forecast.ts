import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import {
  buildRuleBasedAlerts,
  deterministicBalanceForecast,
} from "@/lib/finance/forecast";
import { deterministicForecastProvider } from "@/server/providers/deterministic-forecast";
import { getDashboardMetrics } from "@/server/services/dashboard";
import { monthlyTotalsForForecast } from "@/server/services/planning";
import { getPlanningOverview } from "@/server/services/planning";

export async function getForecastInsights(userId: string, workspaceId: string) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const [dashboard, monthTotals, planning] = await Promise.all([
    getDashboardMetrics(userId, workspaceId),
    monthlyTotalsForForecast(userId, workspaceId),
    getPlanningOverview(userId, workspaceId),
  ]);

  if (!dashboard || !monthTotals || !planning) return null;

  const forecast = deterministicBalanceForecast({
    startingBalance: dashboard.kpis.totalBalance,
    expectedMonthlyIncome: monthTotals.income,
    expectedMonthlyExpenses: monthTotals.expenses,
    horizonMonths: 12,
  });

  const alerts = buildRuleBasedAlerts({
    cashFlowMonth: dashboard.kpis.economicResultMonth,
    savingsBalance: dashboard.kpis.savingsBalance,
    emergencyTarget: planning.emergencyTarget,
  });

  return {
    provider: deterministicForecastProvider.name,
    explanation:
      "Previsões determinísticas de tesouraria (saldo real + ocorrências previstas). Não utiliza machine learning.",
    forecast,
    alerts,
    monthTotals,
  };
}
