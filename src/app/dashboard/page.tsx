import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { DashboardGreeting, DashboardHeaderActions } from "@/components/dashboard/dashboard-header";
import { DashboardKpiCard } from "@/components/dashboard/dashboard-kpi-card";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { safePercentChange } from "@/lib/finance/kpi";
import { readPageFlash } from "@/lib/ui/page-shell";
import { getDashboardMetrics } from "@/server/services/dashboard";
import { listFinancialAlerts, countUnseenFinancialAlerts } from "@/server/services/financial-alerts";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

function trendLabel(current: string, previous: string): { text: string | null; positive: boolean | null } {
  const pct = safePercentChange(current, previous);
  if (pct === null) return { text: null, positive: null };
  const sign = pct > 0 ? "+" : "";
  return {
    text: `${sign}${pct}% vs. mês anterior`,
    positive: pct >= 0,
  };
}

async function DashboardContent() {
  await ensureRequestDynamic();
  const flash = await readPageFlash();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const membership = await requireWorkspaceAccess(user.id, selected.id);
  if (!membership) redirect("/inicio");

  const [metrics, alerts, unseenCount] = await Promise.all([
    getDashboardMetrics(user.id, selected.id),
    listFinancialAlerts(user.id, selected.id),
    countUnseenFinancialAlerts(user.id, selected.id),
  ]);
  if (!metrics || !alerts) redirect("/inicio");

  const { kpis, previous, widgets } = metrics;
  const incomeTrend = trendLabel(kpis.incomeMonth, previous.incomeMonth);
  const expenseTrend = trendLabel(kpis.expenseMonth, previous.expenseMonth);
  const expenseTrendDisplay = expenseTrend.text
    ? {
        text: expenseTrend.text,
        positive: expenseTrend.positive === null ? null : !expenseTrend.positive,
      }
    : { text: null, positive: null };

  const resultTrend = trendLabel(kpis.economicResultMonth, previous.economicResultMonth);

  return (
    <AppShell
      visualTheme="aurora"
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      flash={flash}
      unseenAlertsCount={unseenCount}
      headerLeading={<DashboardGreeting userName={user.name} />}
      headerActions={<DashboardHeaderActions unseenAlertsCount={unseenCount} />}
    >
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardKpiCard
          label="Saldo total"
          value={kpis.totalBalance}
          tone="accent"
          icon="💰"
          href="/contas"
        />
        <DashboardKpiCard
          label="Receitas (mês)"
          value={kpis.incomeMonth}
          tone="income"
          icon="↑"
          href="/receitas"
          trendLabel={incomeTrend.text}
          trendPositive={incomeTrend.positive}
        />
        <DashboardKpiCard
          label="Despesas (mês)"
          value={kpis.expenseMonth}
          tone="expense"
          icon="↓"
          href="/despesas"
          trendLabel={expenseTrendDisplay.text}
          trendPositive={expenseTrendDisplay.positive}
        />
        <DashboardKpiCard
          label="Resultado económico (mês)"
          value={kpis.economicResultMonth}
          tone="analytic"
          icon="◎"
          trendLabel={resultTrend.text}
          trendPositive={resultTrend.positive}
        />
      </div>

      <DashboardGrid
        incomeMonth={kpis.incomeMonth}
        expenseMonth={kpis.expenseMonth}
        incomeByCategory={widgets.incomeByCategory}
        expenseByCategory={metrics.expenseByCategory}
        balanceSeries={widgets.balanceSeries}
        realBalance={widgets.realBalance}
        treasuryBars={widgets.treasuryBars}
        budgetUtilization={widgets.budgetUtilization}
        budgetCategories={widgets.budgetCategories}
        budgetSummary={widgets.budgetSummary}
        topAccounts={widgets.topAccounts}
        upcomingRecurring={widgets.upcomingRecurring}
        patrimony={widgets.patrimony}
        alerts={alerts}
      />
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">A carregar dashboard…</p>}>
      <DashboardContent />
    </Suspense>
  );
}
