import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BudgetOverviewCharts } from "@/components/budget/budget-overview-charts";
import { NewBudgetDrawer } from "@/components/budget/new-budget-drawer";
import { DashboardKpiCard } from "@/components/dashboard/dashboard-kpi-card";
import { AppShell } from "@/components/shell/app-shell";
import {
  FinanceTable,
  FinanceTableBody,
  FinanceTableCell,
  FinanceTableHead,
  FinanceTableHeaderCell,
  FinanceTableRow,
} from "@/components/ui/finance-table";
import { filterApplyButtonClassName, inputClassName, secondaryButtonClassName } from "@/components/ui/form-styles";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { appConfig } from "@/lib/config";
import { civilDateFromInstant, TIME_ZONE } from "@/lib/datetime/civil-date";
import {
  deleteBudgetLineAction,
  deleteMonthlyBudgetAction,
  upsertBudgetLineAction,
} from "@/lib/finance/budget-actions";
import { decimal, formatEUR } from "@/lib/finance/money";
import { readPageFlash } from "@/lib/ui/page-shell";
import { getBudgetOverview } from "@/server/services/budgets";
import { getExpenseAnalysis } from "@/server/services/expense-analysis";
import { countUnseenFinancialAlerts, listFinancialAlerts } from "@/server/services/financial-alerts";
import { listSavingsGoalSummaries } from "@/server/services/planning";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

type SearchParams = Promise<{ year?: string; month?: string }>;

const MONTHS = Array.from({ length: 12 }, (_, index) => {
  const label = new Intl.DateTimeFormat(appConfig.locale, {
    month: "long",
    timeZone: TIME_ZONE,
  }).format(new Date(Date.UTC(2026, index, 15)));
  return label.charAt(0).toUpperCase() + label.slice(1);
});

function budgetStatus(utilization: number | null, overage: string) {
  if (decimal(overage).gt(0)) return { label: "Excedido", variant: "danger" as const };
  if (utilization != null && utilization >= 85) return { label: "Próximo do limite", variant: "warning" as const };
  if (utilization == null) return { label: "Limite sem valor positivo", variant: "muted" as const };
  return { label: "Dentro do limite", variant: "success" as const };
}

async function OrcamentosContent({ searchParams }: { searchParams: SearchParams }) {
  await ensureRequestDynamic();
  const flash = await readPageFlash("/orcamentos");
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const params = await searchParams;
  const civil = civilDateFromInstant(new Date());
  const year = params.year ? Number(params.year) : civil.year;
  const month = params.month ? Number(params.month) : civil.month;
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) redirect("/orcamentos");

  const [overview, analysis, alerts, unseenCount, goals] = await Promise.all([
    getBudgetOverview(user.id, selected.id, year, month),
    getExpenseAnalysis(user.id, selected.id, year, month),
    listFinancialAlerts(user.id, selected.id),
    countUnseenFinancialAlerts(user.id, selected.id),
    listSavingsGoalSummaries(user.id, selected.id),
  ]);
  if (!overview || !analysis || !alerts || !goals) redirect("/inicio");

  const budgetedIds = new Set(overview.lines.map((line) => line.categoryId));
  let monthExpenses = decimal(0);
  let unbudgeted = decimal(0);
  for (const [categoryId, row] of Object.entries(overview.spentMap)) {
    const spent = decimal(row.spent);
    monthExpenses = monthExpenses.plus(spent);
    if (!budgetedIds.has(categoryId)) unbudgeted = unbudgeted.plus(spent);
  }

  const exceeded = overview.lines.filter((line) => decimal(line.overage).gt(0)).length;
  const utilization = overview.summary.utilizationPercent;
  const budgetAlerts = alerts.filter(
    (alert) =>
      (alert.type === "BUDGET_NEAR_LIMIT" || alert.type === "BUDGET_EXCEEDED") &&
      !alert.dismissedAt &&
      !alert.resolvedAt,
  );

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
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Orçamentos</h1>
          <p className="mt-0.5 text-sm text-slate-500">Controla os teus gastos e cumpre os teus objetivos.</p>
        </div>
      }
      headerActions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <form method="get" className="flex min-w-0 items-center gap-2">
            <select name="month" defaultValue={String(month)} aria-label="Mês" className={`${inputClassName} mt-0 w-auto min-w-0`}>
              {MONTHS.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </select>
            <input
              name="year"
              type="number"
              min={2000}
              max={2100}
              defaultValue={year}
              aria-label="Ano"
              className={`${inputClassName} mt-0 w-24 min-w-0`}
            />
            <button type="submit" className={filterApplyButtonClassName}>
              Aplicar
            </button>
          </form>
          <NewBudgetDrawer year={year} month={month} categories={overview.categories} />
        </div>
      }
    >
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardKpiCard
          label="Orçamento do mês"
          value={overview.summary.totalLimit}
          tone="accent"
          icon="◎"
          trendLabel="Limite total"
        />
        <DashboardKpiCard
          label="Gasto até agora"
          value={overview.summary.totalSpent}
          tone="expense"
          icon="↓"
          trendLabel="Só categorias com limite"
        />
        <DashboardKpiCard
          label="Disponível"
          value={overview.summary.totalAvailable}
          tone="income"
          icon="✓"
          trendLabel="Limite menos gasto orçamentado"
        />
        <DashboardKpiCard
          label="Estado do orçamento"
          value={overview.lines.length === 0 ? "Por configurar" : utilization != null ? `${utilization}%` : "—"}
          rawValue
          tone={exceeded > 0 ? "expense" : "analytic"}
          icon="#"
          trendLabel={
            overview.lines.length === 0
              ? "Sem limites neste mês"
              : exceeded > 0
                ? `${exceeded} categoria(s) excedida(s)`
                : "Utilização dos limites"
          }
        />
      </div>

      <p className="mt-4 text-sm text-slate-600">
        Despesas realizadas no mês: {formatEUR(monthExpenses.toFixed(2))}. O gasto do orçamento não inclui categorias sem limite.
        {unbudgeted.gt(0) ? ` Despesas sem limite definido: ${formatEUR(unbudgeted.toFixed(2))}.` : ""}
      </p>

      <div className="mt-5">
        <BudgetOverviewCharts
          bars={overview.lines.map((line) => ({
            name: line.categoryName,
            budget: Number(line.limitAmount),
            spent: Number(line.spentAmount),
          }))}
          expenses={analysis.byCategory.map((row) => ({ name: row.name, value: row.total }))}
          expenseTotal={analysis.totalMonth}
        />
      </div>

      <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-5">
        <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] lg:col-span-3">
          <h2 className="text-base font-semibold">Detalhes dos orçamentos</h2>
          <p className="mt-1 text-sm text-slate-500">Acompanha o progresso de cada categoria com limite.</p>
          {overview.lines.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">Ainda não há limites neste mês. Usa Novo orçamento para criar o primeiro.</p>
          ) : (
            <FinanceTable caption="Limites do mês" className="mt-4">
              <FinanceTableHead>
                <FinanceTableHeaderCell>Categoria</FinanceTableHeaderCell>
                <FinanceTableHeaderCell align="right">Orçamento</FinanceTableHeaderCell>
                <FinanceTableHeaderCell align="right">Gasto</FinanceTableHeaderCell>
                <FinanceTableHeaderCell align="right">Disponível</FinanceTableHeaderCell>
                <FinanceTableHeaderCell>Estado</FinanceTableHeaderCell>
                <FinanceTableHeaderCell>Ações</FinanceTableHeaderCell>
              </FinanceTableHead>
              <FinanceTableBody>
                {overview.lines.map((line) => {
                  const status = budgetStatus(line.utilizationPercent, line.overage);
                  return (
                    <FinanceTableRow key={line.lineId}>
                      <FinanceTableCell className="font-medium">{line.categoryName}</FinanceTableCell>
                      <FinanceTableCell align="right">{formatEUR(line.limitAmount)}</FinanceTableCell>
                      <FinanceTableCell align="right">{formatEUR(line.spentAmount)}</FinanceTableCell>
                      <FinanceTableCell align="right">{formatEUR(line.available)}</FinanceTableCell>
                      <FinanceTableCell>
                        <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
                        <ProgressBar
                          className="mt-2 w-24"
                          value={line.utilizationPercent ?? 0}
                          tone={decimal(line.overage).gt(0) ? "expense" : "income"}
                        />
                      </FinanceTableCell>
                      <FinanceTableCell>
                        <form action={upsertBudgetLineAction} className="flex min-w-0 flex-wrap items-center gap-2">
                          <input type="hidden" name="year" value={year} />
                          <input type="hidden" name="month" value={month} />
                          <input type="hidden" name="categoryId" value={line.categoryId} />
                          <input
                            name="limitAmount"
                            defaultValue={line.limitAmount}
                            aria-label={`Novo limite ${line.categoryName}`}
                            className={`${inputClassName} mt-0 w-24`}
                          />
                          <button type="submit" className="text-sm font-medium text-blue-700 hover:underline">
                            Atualizar
                          </button>
                        </form>
                        <form action={deleteBudgetLineAction} className="mt-1">
                          <input type="hidden" name="lineId" value={line.lineId} />
                          <button type="submit" className="text-sm text-rose-700 hover:underline">
                            Remover limite
                          </button>
                        </form>
                      </FinanceTableCell>
                    </FinanceTableRow>
                  );
                })}
              </FinanceTableBody>
            </FinanceTable>
          )}
          {overview.budget ? (
            <form action={deleteMonthlyBudgetAction} className="mt-4">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="month" value={month} />
              <button type="submit" className={secondaryButtonClassName}>
                Eliminar orçamento do mês
              </button>
            </form>
          ) : null}
        </section>

        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Metas e objetivos</h2>
              <Link href="/plano" className="text-xs font-medium text-blue-600 hover:underline">
                Ver plano
              </Link>
            </div>
            {goals.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">Sem objetivos de poupança. Cria um em Planeamento.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {goals.map((goal) => (
                  <li key={goal.id}>
                    <p className="text-sm font-medium">{goal.title}</p>
                    <p className="text-xs text-slate-500">
                      {formatEUR(goal.contributed)} de {formatEUR(goal.targetAmount)}
                    </p>
                    <ProgressBar className="mt-2" value={goal.progressPercent ?? 0} tone="accent" />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Alertas de orçamento</h2>
              <Link href="/alertas" className="text-xs font-medium text-blue-600 hover:underline">
                Ver alertas
              </Link>
            </div>
            {budgetAlerts.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">Sem alertas de limite neste workspace.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {budgetAlerts.slice(0, 4).map((alert) => (
                  <li key={alert.id}>
                    <p className="text-sm font-medium">{alert.title}</p>
                    <p className="text-xs text-slate-500">{alert.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

export default function OrcamentosPage(props: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm">A carregar orçamentos…</p>}>
      <OrcamentosContent searchParams={props.searchParams} />
    </Suspense>
  );
}
