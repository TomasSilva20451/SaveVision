import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { RequestDynamicPage } from "@/components/shell/request-dynamic-page";
import { DashboardKpiCard } from "@/components/dashboard/dashboard-kpi-card";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { formatEUR } from "@/lib/finance/money";
import { readPageFlash } from "@/lib/ui/page-shell";
import { getCorporateTreasuryDashboard } from "@/server/services/corporate-treasury";
import { countUnseenFinancialAlerts } from "@/server/services/financial-alerts";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

type PageProps = { searchParams: Promise<{ horizon?: string }> };

async function EmpresaTesourariaPageContent({ searchParams }: PageProps) {
  await ensureRequestDynamic();
  const flash = await readPageFlash("/empresa/tesouraria");
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const params = await searchParams;
  const horizon = Number(params.horizon ?? "30");

  const [data, unseenCount] = await Promise.all([
    getCorporateTreasuryDashboard(user.id, selected.id, horizon),
    countUnseenFinancialAlerts(user.id, selected.id),
  ]);
  if (!data) redirect("/inicio");

  const { treasury, baseline, reconciliation } = data;

  return (
    <AppShell
      visualTheme="aurora"
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      flash={flash}
      unseenAlertsCount={unseenCount}
      headerLeading={
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Tesouraria empresarial</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Vista consolidada read-only — previsões, simulações e fiabilidade do extrato reconciliado.
          </p>
        </div>
      }
    >
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/previsoes" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-800">
          Abrir previsões
        </Link>
        <Link href="/simulacoes" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-800">
          Abrir simulações
        </Link>
        <Link href="/reconciliacao" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-900">
          Reconciliação
        </Link>
      </div>

      <div className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div data-testid="corp-treasury-real-balance">
          <DashboardKpiCard label="Saldo real" value={treasury.realBalance} tone="accent" icon="€" />
        </div>
        <div data-testid="corp-treasury-projected">
          <DashboardKpiCard
            label={`Saldo projetado (${horizon}d)`}
            value={treasury.base.projectedBalance}
            tone="analytic"
            icon="↗"
          />
        </div>
        <div data-testid="corp-treasury-recon-unmatched">
          <DashboardKpiCard
            label="Extrato por reconciliar"
            value={String(reconciliation.unmatchedCount)}
            tone="expense"
            rawValue
            icon="!"
          />
        </div>
        <div data-testid="corp-treasury-recon-matched">
          <DashboardKpiCard
            label="Linhas emparelhadas"
            value={String(reconciliation.matchedCount)}
            tone="income"
            rawValue
            icon="✓"
          />
        </div>
      </div>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
          <h2 className="font-semibold text-slate-900">Baseline de simulação</h2>
          <dl className="mt-3 space-y-2 text-slate-600">
            <div className="flex justify-between gap-4">
              <dt>Saldo agregado</dt>
              <dd className="font-medium tabular-nums text-slate-900">{formatEUR(baseline.aggregateBalance)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Receitas (mês civil)</dt>
              <dd className="font-medium tabular-nums text-slate-900">{formatEUR(baseline.monthlyIncomeObserved)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Despesas (mês civil)</dt>
              <dd className="font-medium tabular-nums text-slate-900">{formatEUR(baseline.monthlyExpenseObserved)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">{baseline.disclaimer}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
          <h2 className="font-semibold text-slate-900">Cenário base ({horizon} dias)</h2>
          <p className="mt-2 text-slate-600">
            Entradas projetadas:{" "}
            <span className="font-medium tabular-nums text-slate-900">{formatEUR(treasury.base.expectedInflows)}</span>
          </p>
          <p className="mt-1 text-slate-600">
            Saídas projetadas:{" "}
            <span className="font-medium tabular-nums text-slate-900">{formatEUR(treasury.base.expectedOutflows)}</span>
          </p>
          {treasury.insights[0] ? (
            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">{treasury.insights[0].description}</p>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}

export default function EmpresaTesourariaPage(props: PageProps) {
  return (
    <RequestDynamicPage fallback={<p className="p-6 text-sm">A carregar tesouraria…</p>}>
      <EmpresaTesourariaPageContent {...props} />
    </RequestDynamicPage>
  );
}
