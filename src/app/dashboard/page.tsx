import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { readPageFlash } from "@/lib/ui/page-shell";
import { FinancialInsightsPanel } from "@/components/insights/financial-insights-panel";
import { FinancialAlertsPanel } from "@/components/alerts/financial-alerts-panel";
import { getDashboardMetrics } from "@/server/services/dashboard";
import { getFinancialInsightsOverview } from "@/server/services/financial-insights";
import {
  countUnseenFinancialAlerts,
  listFinancialAlerts,
} from "@/server/services/financial-alerts";
import Link from "next/link";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

async function DashboardContent() {
  await ensureRequestDynamic();
  const flash = await readPageFlash();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const membership = await requireWorkspaceAccess(user.id, selected.id);
  if (!membership) redirect("/inicio");

  const [metrics, insightsOverview, alerts, unseenCount] = await Promise.all([
    getDashboardMetrics(user.id, selected.id),
    getFinancialInsightsOverview(user.id, selected.id),
    listFinancialAlerts(user.id, selected.id),
    countUnseenFinancialAlerts(user.id, selected.id),
  ]);
  if (!metrics || !insightsOverview || !alerts) redirect("/inicio");

  const { kpis, previous, monthlyBuckets, expenseByCategory } = metrics;

  return (
    <AppShell
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      flash={flash}
      unseenAlertsCount={unseenCount}
    >
      <PageHeader
        title="Dashboard"
        description={`Workspace «${selected.name}» · mês civil (Europe/Lisbon) · valores da base de dados`}
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Saldo total" value={kpis.totalBalance} highlight />
        <MetricCard label="Saldo disponível" value={kpis.availableBalance} />
        <MetricCard label="Poupança" value={kpis.savingsBalance} />
        <MetricCard
          label="Património líquido"
          value={kpis.netPatrimony ?? kpis.netWorth}
          href="/patrimonio"
        />
        <MetricCard
          label="Orçamento (mês)"
          value={kpis.budgetLimitMonth ?? "0.00"}
          href="/orcamentos"
        />
        <MetricCard label="Orçamento gasto" value={kpis.budgetSpentMonth ?? "0.00"} />
        <MetricCard label="Orçamento disponível" value={kpis.budgetAvailableMonth ?? "0.00"} />
        <MetricCard label="Passivos" value={kpis.liabilitiesTotal ?? "0.00"} href="/patrimonio" />
        <MetricCard
          label="Receitas recebidas (mês)"
          value={kpis.incomeMonth}
          previous={previous.incomeMonth}
        />
        <MetricCard label="Receitas esperadas" value={kpis.expectedIncome} />
        <MetricCard
          label="Despesas (mês)"
          value={kpis.expenseMonth}
          previous={previous.expenseMonth}
        />
        <MetricCard
          label="Resultado económico (mês)"
          value={kpis.economicResultMonth}
        />
        <MetricCard
          label="Movimento de caixa (mês)"
          value={kpis.netCashMovementMonth}
        />
        <MetricCard
          label="Obrigações previstas (mês)"
          value={kpis.recurringExpectedMonth ?? "0.00"}
          href="/despesas-recorrentes"
        />
        <MetricCard
          label="A pagar (30 dias)"
          value={kpis.recurringDue30Total ?? "0.00"}
          href="/despesas-recorrentes"
        />
      </div>

      <section className="mt-8" data-testid="dashboard-alerts-section">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Alertas financeiros</h2>
          <Link href="/alertas" className="text-sm underline">
            Ver todos os alertas
          </Link>
        </div>
        <FinancialAlertsPanel alerts={alerts} compact />
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Insights financeiros</h2>
          <Link href="/analises" className="text-sm underline">
            Ver todas as análises
          </Link>
        </div>
        <FinancialInsightsPanel
          summary={insightsOverview.summary}
          insights={insightsOverview.highlights}
          compact
        />
      </section>

      <Card title="Evolução e categorias" className="mt-8">
        <DashboardCharts
          monthlyBuckets={monthlyBuckets}
          expenseByCategory={expenseByCategory}
        />
      </Card>
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
