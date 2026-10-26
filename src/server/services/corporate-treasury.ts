import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db";
import { getSimulationBaseline } from "@/server/services/financial-simulations";
import { getTreasuryForecastDashboard } from "@/server/services/treasury-forecast";

/** Vista corporativa read-only: previsões + baseline de simulação + saúde da reconciliação. */
export async function getCorporateTreasuryDashboard(
  userId: string,
  workspaceId: string,
  horizonDays = 30,
) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const [treasury, baseline, unmatchedCount, matchedCount] = await Promise.all([
    getTreasuryForecastDashboard(userId, workspaceId, horizonDays),
    getSimulationBaseline(userId, workspaceId),
    db.bankFeedLine.count({ where: { workspaceId, status: "UNMATCHED" } }),
    db.bankReconciliationMatch.count({ where: { workspaceId } }),
  ]);

  if (!treasury || !baseline) return null;

  return {
    treasury,
    baseline,
    reconciliation: { unmatchedCount, matchedCount },
    horizonDays,
  };
}
