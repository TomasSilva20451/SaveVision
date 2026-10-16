import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ExpenseAnalysisCharts } from "@/components/budget/expense-analysis-charts";
import { AppShell } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  inputClassName,
  labelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/ui/form-styles";
import { PageHeader } from "@/components/ui/page-header";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import {
  deleteBudgetLineAction,
  deleteMonthlyBudgetAction,
  upsertBudgetLineAction,
} from "@/lib/finance/budget-actions";
import { formatEUR } from "@/lib/finance/money";
import { readPageFlash } from "@/lib/ui/page-shell";
import { civilDateFromInstant } from "@/lib/datetime/civil-date";
import { getBudgetOverview } from "@/server/services/budgets";
import { getExpenseAnalysis } from "@/server/services/expense-analysis";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

type SearchParams = Promise<{ year?: string; month?: string }>;

async function OrcamentosContent({ searchParams }: { searchParams: SearchParams }) {
  await ensureRequestDynamic();
  const flash = await readPageFlash();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const membership = await requireWorkspaceAccess(user.id, selected.id);
  if (!membership) redirect("/inicio");

  const params = await searchParams;
  const civil = civilDateFromInstant(new Date());
  const year = params.year ? Number(params.year) : civil.year;
  const month = params.month ? Number(params.month) : civil.month;

  const [overview, analysis] = await Promise.all([
    getBudgetOverview(user.id, selected.id, year, month),
    getExpenseAnalysis(user.id, selected.id, year, month),
  ]);

  if (!overview || !analysis) redirect("/inicio");

  const budgetCompare = overview.lines.map((line) => ({
    name: line.categoryName,
    budget: Number(line.limitAmount),
    spent: Number(line.spentAmount),
  }));

  return (
    <AppShell
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      flash={flash}
    >
      <PageHeader
        title="Orçamentos"
        description="Limites mensais por categoria. Despesas reais excluem transferências internas."
      />

      <Card title="Período" className="mt-8">
        <form method="get" className="flex flex-wrap items-end gap-4">
          <label className={labelClassName}>
            Ano
            <input
              name="year"
              type="number"
              min={2000}
              max={2100}
              defaultValue={year}
              className={inputClassName}
            />
          </label>
          <label className={labelClassName}>
            Mês
            <input
              name="month"
              type="number"
              min={1}
              max={12}
              defaultValue={month}
              className={inputClassName}
            />
          </label>
          <button type="submit" className={primaryButtonClassName}>
            Aplicar
          </button>
        </form>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Limite total">
          <p className="text-2xl font-semibold">{formatEUR(overview.summary.totalLimit)}</p>
        </Card>
        <Card title="Despesas realizadas">
          <p className="text-2xl font-semibold">{formatEUR(overview.summary.totalSpent)}</p>
        </Card>
        <Card title="Disponível">
          <p className="text-2xl font-semibold">{formatEUR(overview.summary.totalAvailable)}</p>
        </Card>
        <Card title="Utilização">
          <p className="text-2xl font-semibold">
            {overview.summary.utilizationPercent != null
              ? `${overview.summary.utilizationPercent} %`
              : "—"}
          </p>
        </Card>
      </div>

      <Card title="Novo limite por categoria" className="mt-8">
        <form action={upsertBudgetLineAction} className="grid max-w-lg gap-4">
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={month} />
          <label className={labelClassName}>
            Categoria
            <select name="categoryId" required className={inputClassName}>
              {overview.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClassName}>
            Limite (EUR)
            <input name="limitAmount" required placeholder="300" className={inputClassName} />
          </label>
          <button type="submit" className={primaryButtonClassName}>
            Guardar limite
          </button>
        </form>
      </Card>

      {overview.lines.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Sem limites definidos"
            description="Adiciona limites por categoria para acompanhar a utilização do orçamento."
          />
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {overview.lines.map((line) => {
            const utilization = line.utilizationPercent ?? 0;
            const over = Number(line.overage) > 0;
            return (
              <li key={line.lineId}>
                <Card title={line.categoryName}>
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <span>Orçamento: {formatEUR(line.limitAmount)}</span>
                    <span>Realizado: {formatEUR(line.spentAmount)}</span>
                    <span>Disponível: {formatEUR(line.available)}</span>
                    {over ? (
                      <span className="font-medium text-red-600">
                        Excesso: {formatEUR(line.overage)}
                      </span>
                    ) : null}
                  </div>
                  <div
                    className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
                    role="progressbar"
                    aria-valuenow={Math.min(utilization, 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Utilização ${line.categoryName}`}
                  >
                    <div
                      className={`h-full ${over ? "bg-red-600" : "bg-emerald-600"}`}
                      style={{ width: `${Math.min(utilization, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Utilização: {line.utilizationPercent != null ? `${line.utilizationPercent} %` : "—"}
                  </p>
                  <form action={deleteBudgetLineAction} className="mt-3">
                    <input type="hidden" name="lineId" value={line.lineId} />
                    <button type="submit" className={secondaryButtonClassName}>
                      Remover limite
                    </button>
                  </form>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {overview.budget ? (
        <form action={deleteMonthlyBudgetAction} className="mt-6">
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={month} />
          <button type="submit" className={secondaryButtonClassName}>
            Eliminar orçamento do mês
          </button>
        </form>
      ) : null}

      <Card title="Análise de despesas" className="mt-10">
        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <p>
            <span className="text-zinc-500">Total mensal:</span>{" "}
            {formatEUR(analysis.totalMonth)}
          </p>
          <p>
            <span className="text-zinc-500">Média (meses com dados):</span>{" "}
            {formatEUR(analysis.averageMonthly)}
          </p>
          <p>
            <span className="text-zinc-500">Vs mês anterior:</span>{" "}
            {analysis.monthChangePercent != null
              ? `${analysis.monthChangePercent} %`
              : "—"}
          </p>
          <p>
            <span className="text-zinc-500">Mês anterior:</span>{" "}
            {formatEUR(analysis.totalPrev)}
          </p>
        </div>
        <ExpenseAnalysisCharts
          byCategory={analysis.byCategory}
          monthlyTotals={analysis.monthlyTotals}
          budgetCompare={budgetCompare}
          hasEnoughHistory={analysis.hasEnoughHistory}
        />
      </Card>

      <p className="mt-6 text-sm text-zinc-500">
        <Link href="/despesas" className="underline">
          Registar despesas
        </Link>{" "}
        para atualizar os valores realizados.
      </p>
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
