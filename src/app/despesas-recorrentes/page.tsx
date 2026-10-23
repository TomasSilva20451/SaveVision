import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NewRecurringDrawer } from "@/components/recurring/new-recurring-drawer";
import { RecurringCharts } from "@/components/recurring/recurring-charts";
import { RecurringPatternSuggestions } from "@/components/recurring/recurring-pattern-suggestions";
import { RecurringExpensesTable } from "@/components/recurring/recurring-expenses-table";
import { AppShell } from "@/components/shell/app-shell";
import { FinanceMetricCard, MetricGrid } from "@/components/ui/finance-metric-card";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { civilDateFromInstant } from "@/lib/datetime/civil-date";
import { formatEUR } from "@/lib/finance/money";
import { readPageFlash } from "@/lib/ui/page-shell";
import { listAccountsWithBalances } from "@/server/services/accounts";
import { countUnseenFinancialAlerts } from "@/server/services/financial-alerts";
import { listWorkspaceLiabilities } from "@/server/services/patrimony";
import { getRecurringExpensesOverview } from "@/server/services/recurring-expenses";
import { listRecurringPatternSuggestions } from "@/server/services/recurring-pattern-suggestions";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

type SearchParams = Promise<{ q?: string; category?: string; status?: string }>;
const VALID_STATUS = new Set(["ALL", "ACTIVE", "PAUSED", "ENDED"]);

async function RecorrentesContent({ searchParams }: { searchParams: SearchParams }) {
  await ensureRequestDynamic();
  const flash = await readPageFlash("/despesas-recorrentes");
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");
  const membership = await requireWorkspaceAccess(user.id, selected.id);
  if (!membership) redirect("/inicio");

  const [accounts, overview, liabilities, unseenAlertsCount, patternSuggestions] = await Promise.all([
    listAccountsWithBalances(user.id, selected.id),
    getRecurringExpensesOverview(user.id, selected.id),
    listWorkspaceLiabilities(user.id, selected.id),
    countUnseenFinancialAlerts(user.id, selected.id),
    listRecurringPatternSuggestions(user.id, selected.id),
  ]);
  if (!overview) redirect("/inicio");

  const params = await searchParams;
  const query = String(params.q ?? "").trim();
  const categoryId = String(params.category ?? "");
  const requestedStatus = String(params.status ?? "ALL").toUpperCase();
  const status = VALID_STATUS.has(requestedStatus) ? requestedStatus : "ALL";
  const normalizedQuery = query.toLocaleLowerCase("pt-PT");
  const visibleSeries = overview.series.filter((series) => {
    if (status !== "ALL" && series.status !== status) return false;
    if (categoryId && series.categoryId !== categoryId) return false;
    return !normalizedQuery || series.name.toLocaleLowerCase("pt-PT").includes(normalizedQuery);
  });

  const now = new Date();
  const civil = civilDateFromInstant(now);
  const periodLabel = new Intl.DateTimeFormat("pt-PT", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Lisbon",
  }).format(now);
  const accountList = accounts ?? [];
  const liabilityList = liabilities ?? [];

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
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-50">Despesas recorrentes</h1>
          <p className="mt-0.5 text-sm text-slate-500">Gere as tuas despesas fixas e recorrentes.</p>
        </div>
      }
      headerActions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm capitalize text-slate-600 sm:inline-flex">{periodLabel}</span>
          <NewRecurringDrawer
            todayIso={`${civil.year}-${String(civil.month).padStart(2, "0")}-${String(civil.day).padStart(2, "0")}`}
            categories={overview.categories}
            accounts={accountList.map((account) => ({ id: account.id, name: account.name, type: account.type }))}
            liabilities={liabilityList.map((liability) => ({ id: liability.id, title: liability.title }))}
          />
        </div>
      }
    >
      <MetricGrid>
        <FinanceMetricCard label="Total mensal" value={overview.summary.monthlyEquivalent} tone="income" icon="▣" hint="Equivalente mensal das recorrências ativas" />
        <FinanceMetricCard label="Despesas ativas" value={String(overview.summary.activeCount)} rawValue tone="accent" icon="▦" hint={`${overview.series.length} recorrência${overview.series.length === 1 ? "" : "s"} no total`} />
        <FinanceMetricCard label="Associadas a passivos" value={String(overview.summary.linkedCount)} rawValue tone="analytic" icon="↗" hint="Sem dupla contagem na previsão" />
        <FinanceMetricCard label="Recorrências em pausa" value={String(overview.summary.pausedCount)} rawValue tone="warning" icon="Ⅱ" hint="Não geram novas ocorrências" />
      </MetricGrid>

      <RecurringPatternSuggestions
        suggestions={patternSuggestions ?? []}
        categories={overview.categories}
        accounts={accountList.map((account) => ({ id: account.id, name: account.name }))}
      />

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-slate-600 shadow-[var(--shadow-card)]">
        <span>Previsto no mês: <strong className="text-slate-900">{formatEUR(overview.summary.expectedMonth)}</strong></span>
        <span>Pago no mês: <strong className="text-emerald-700">{formatEUR(overview.summary.paidMonth)}</strong></span>
        <span>Por pagar: <strong className="text-rose-700">{formatEUR(overview.summary.unpaidMonth)}</strong></span>
      </div>

      <div className="mt-5">
        <RecurringCharts
          months={overview.evolution.map((month) => ({ label: month.label, expected: Number(month.expected), paid: Number(month.paid) }))}
          slices={overview.categoryMonthly}
          total={overview.summary.monthlyEquivalent}
        />
      </div>

      {accountList.length === 0 ? (
        <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Podes criar recorrências sem conta predefinida, mas precisas de uma conta para confirmar pagamentos.</p>
      ) : null}

      <div className="mt-5 pb-10">
        <RecurringExpensesTable
          allSeries={overview.series}
          visibleSeries={visibleSeries}
          categories={overview.categories}
          accounts={accountList.map((account) => ({ id: account.id, name: account.name, type: account.type }))}
          liabilities={liabilityList.map((liability) => ({ id: liability.id, title: liability.title }))}
          history={overview.history}
          query={query}
          categoryId={categoryId}
          status={status}
          now={now}
        />
      </div>
    </AppShell>
  );
}

export default function DespesasRecorrentesPage(props: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm">A carregar despesas recorrentes…</p>}>
      <RecorrentesContent searchParams={props.searchParams} />
    </Suspense>
  );
}
