import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { IncomeCharts } from "@/components/income/income-charts";
import { IncomeIcon } from "@/components/income/income-icon";
import { IncomeSourcesTable } from "@/components/income/income-sources-table";
import { NewIncomeDrawer } from "@/components/income/new-income-drawer";
import { UpcomingIncomePanel } from "@/components/income/upcoming-income-panel";
import { FinanceMetricCard, MetricGrid } from "@/components/ui/finance-metric-card";
import { filterApplyButtonClassName } from "@/components/ui/form-styles";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { civilDateFromInstant, formatCivilDateIso } from "@/lib/datetime/civil-date";
import { decimal, formatEUR } from "@/lib/finance/money";
import { readPageFlash } from "@/lib/ui/page-shell";
import { listAccountsWithBalances } from "@/server/services/accounts";
import { countUnseenFinancialAlerts } from "@/server/services/financial-alerts";
import { listIncomeOverview } from "@/server/services/income";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

type SearchParams = Promise<{ period?: string; q?: string; source?: string; status?: string }>;

function selectedPeriod(value: string | undefined) {
  const today = civilDateFromInstant(new Date());
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!match) return { year: today.year, month: today.month };
  const year = Number(match[1]);
  const month = Number(match[2]);
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12 ? { year, month } : { year: today.year, month: today.month };
}

function periodLabel(year: number, month: number) {
  const value = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric", timeZone: "Europe/Lisbon" }).format(new Date(Date.UTC(year, month - 1, 15, 12)));
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function periodOptions(year: number, month: number) {
  return Array.from({ length: 25 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 + index - 12, 15, 12));
    const optionYear = date.getUTCFullYear();
    const optionMonth = date.getUTCMonth() + 1;
    return {
      value: `${optionYear}-${String(optionMonth).padStart(2, "0")}`,
      label: periodLabel(optionYear, optionMonth),
    };
  });
}

async function ReceitasContent({ searchParams }: { searchParams: SearchParams }) {
  await ensureRequestDynamic();
  const params = await searchParams;
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");
  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");
  if (!(await requireWorkspaceAccess(user.id, selected.id))) redirect("/inicio");

  const period = selectedPeriod(params.period);
  const [accounts, overview, flash, unseenAlertsCount] = await Promise.all([
    listAccountsWithBalances(user.id, selected.id),
    listIncomeOverview(user.id, selected.id, period.year, period.month),
    readPageFlash("/receitas"),
    countUnseenFinancialAlerts(user.id, selected.id),
  ]);
  if (!overview) redirect("/inicio");
  const accountOptions = accounts ?? [];
  const query = (params.q ?? "").trim();
  const source = params.source || "ALL";
  const status = params.status || "ALL";
  const visibleSources = overview.sources.filter((row) =>
    (source === "ALL" || row.sourceType === source) &&
    (status === "ALL" || row.status === status) &&
    (!query || `${row.title} ${row.sourceLabel}`.toLocaleLowerCase("pt-PT").includes(query.toLocaleLowerCase("pt-PT"))),
  );
  const total = decimal(overview.summary.total);
  const annualPositive = decimal(overview.summary.annualDifference).gte(0);
  const todayIso = formatCivilDateIso(civilDateFromInstant(new Date()));
  const monthValue = `${period.year}-${String(period.month).padStart(2,"0")}`;
  const monthOptions = periodOptions(period.year, period.month);

  return <AppShell visualTheme="aurora" userName={user.name} workspaces={workspaces} activeWorkspaceId={selected.id} flash={flash} unseenAlertsCount={unseenAlertsCount}
    headerLeading={<div><h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">Receitas</h1><p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">Acompanha e gere todas as tuas fontes de rendimento.</p></div>}
    headerActions={<><form method="get" className="flex items-center"><label className="sr-only" htmlFor="income-period">Mês das receitas</label><select id="income-period" name="period" defaultValue={monthValue} className="h-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm shadow-sm">{monthOptions.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select><button type="submit" className={filterApplyButtonClassName}>Ver</button></form><NewIncomeDrawer accounts={accountOptions} todayIso={todayIso}/></>}>
    {accountOptions.length === 0 ? <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Cria uma conta financeira antes de registares receitas.</div> : null}
    <MetricGrid>
      <FinanceMetricCard label="Total de receitas (mês)" value={overview.summary.total} tone="income" icon={<IncomeIcon kind="TOTAL"/>} hint={total.isZero()?"Sem receitas no mês":`${overview.summary.confirmedShare}% já confirmado`}/>
      <FinanceMetricCard label="Receitas confirmadas" value={overview.summary.confirmed} tone="accent" icon={<IncomeIcon kind="SALARY"/>} hint={`${overview.summary.confirmedShare}% do total`}/>
      <FinanceMetricCard label="Receitas previstas" value={overview.summary.expected} tone="analytic" icon={<IncomeIcon kind="FAMILY_TRANSFER"/>} hint={`${overview.summary.expectedShare}% do total`}/>
      <FinanceMetricCard label="Variação anual" value={overview.summary.hasAnnualComparison ? formatEUR(overview.summary.annualDifference) : "Dados insuficientes"} rawValue tone={annualPositive?"income":"expense"} icon={<span aria-hidden>{annualPositive?"↗":"↘"}</span>} hint={overview.summary.annualPercent === null ? "Sem período homólogo comparável" : `${annualPositive?"+ ":""}${overview.summary.annualPercent}% vs. período homólogo`}/>
    </MetricGrid>
    <div className="mt-5"><IncomeCharts evolution={overview.evolution} distribution={overview.distribution} total={overview.summary.total} periodLabel={periodLabel(period.year,period.month)}/></div>
    <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(18rem,1fr)]"><IncomeSourcesTable allRows={overview.sources} visibleRows={visibleSources} source={source} status={status} query={query} period={monthValue}/><UpcomingIncomePanel rows={overview.upcoming} expectedTotal={overview.summary.expected}/></div>
  </AppShell>;
}

export default function ReceitasPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<p className="p-6 text-sm">A carregar receitas…</p>}><ReceitasContent searchParams={searchParams}/></Suspense>;
}
