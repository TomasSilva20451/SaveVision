import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { AnalyticsDashboard } from "@/components/insights/analytics-dashboard";
import { filterApplyButtonClassName } from "@/components/ui/form-styles";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { readPageFlash } from "@/lib/ui/page-shell";
import { countUnseenFinancialAlerts } from "@/server/services/financial-alerts";
import {
  getFinancialInsightsOverview,
  type AnalysisPeriod,
} from "@/server/services/financial-insights";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

type PageProps = { searchParams: Promise<{ period?: string }> };

async function AnalisesContent({ period }: { period: AnalysisPeriod }) {
  await ensureRequestDynamic();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");
  if (!(await requireWorkspaceAccess(user.id, selected.id))) redirect("/inicio");

  const [overview, flash, unseenAlertsCount] = await Promise.all([
    getFinancialInsightsOverview(user.id, selected.id, period),
    readPageFlash("/analises"),
    countUnseenFinancialAlerts(user.id, selected.id),
  ]);
  if (!overview) redirect("/inicio");

  return (
    <AppShell
      visualTheme="aurora"
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      flash={flash}
      unseenAlertsCount={unseenAlertsCount}
      headerLeading={
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Análises financeiras</h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Obtém insights sobre os teus hábitos financeiros e identifica oportunidades de melhoria.
          </p>
        </div>
      }
      headerActions={
        <form method="get" className="flex items-center gap-1">
          <label htmlFor="analysis-period" className="sr-only">Período de análise</label>
          <select id="analysis-period" name="period" defaultValue={period} className="h-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm">
            <option value="3">Últimos 3 meses</option>
            <option value="6">Últimos 6 meses</option>
            <option value="12">Últimos 12 meses</option>
            <option value="year">Este ano</option>
          </select>
          <button className={filterApplyButtonClassName}>Aplicar</button>
        </form>
      }
    >
      <AnalyticsDashboard analytics={overview.analytics} insights={overview.insights} />
    </AppShell>
  );
}

async function AnalisesInner({ searchParams }: PageProps) {
  const params = await searchParams;
  const requested = params.period as AnalysisPeriod;
  const period: AnalysisPeriod = (["3", "6", "12", "year"] as const).includes(requested) ? requested : "6";
  return <AnalisesContent period={period} />;
}

export default function AnalisesPage(props: PageProps) {
  return <Suspense fallback={<p className="p-6 text-sm">A carregar análises…</p>}><AnalisesInner searchParams={props.searchParams}/></Suspense>;
}
