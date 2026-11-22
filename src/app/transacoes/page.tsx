import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DashboardKpiCard } from "@/components/dashboard/dashboard-kpi-card";
import { AppShell } from "@/components/shell/app-shell";
import { CategorizationReviewPanel } from "@/components/transactions/categorization-review-panel";
import { NewTransactionDrawer } from "@/components/transactions/new-transaction-drawer";
import { TransactionCharts } from "@/components/transactions/transaction-charts";
import { TransactionsFilters } from "@/components/transactions/transactions-filters";
import {
  FinanceTable,
  FinanceTableBody,
  FinanceTableCell,
  FinanceTableHead,
  FinanceTableHeaderCell,
  FinanceTableRow,
} from "@/components/ui/finance-table";
import { PageSuspenseFallback } from "@/components/ui/loading";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { civilDateFromInstant, formatCivilDate } from "@/lib/datetime/civil-date";
import { decimal, formatEUR } from "@/lib/finance/money";
import { readPageFlash } from "@/lib/ui/page-shell";
import { countUnseenFinancialAlerts } from "@/server/services/financial-alerts";
import { getTransactionsPage } from "@/server/services/transactions-page";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

type SearchParams = Promise<{
  q?: string;
  accountId?: string;
  categoryId?: string;
  type?: string;
  from?: string;
  to?: string;
  period?: string;
  page?: string;
  review?: string;
}>;

function typeBadge(type: string) {
  if (type === "INCOME") return <StatusBadge variant="success">Receita</StatusBadge>;
  if (type === "EXPENSE") return <StatusBadge variant="danger">Despesa</StatusBadge>;
  if (type === "TRANSFER") return <StatusBadge variant="info">Transferência</StatusBadge>;
  if (type === "ADJUSTMENT") return <StatusBadge variant="muted">Ajustamento</StatusBadge>;
  return <StatusBadge variant="muted">{type}</StatusBadge>;
}

function monthOptions(anchor: { year: number; month: number }, selected: string) {
  const options = Array.from({ length: 24 }, (_, index) => {
    const date = new Date(Date.UTC(anchor.year, anchor.month - 1 - index, 15, 12));
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const value = `${year}-${String(month).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("pt-PT", {
      month: "long",
      year: "numeric",
      timeZone: "Europe/Lisbon",
    }).format(date);
    return { value, label: label.charAt(0).toUpperCase() + label.slice(1) };
  });
  if (selected && !options.some((option) => option.value === selected)) {
    const [year, month] = selected.split("-").map(Number);
    const label = new Intl.DateTimeFormat("pt-PT", {
      month: "long",
      year: "numeric",
      timeZone: "Europe/Lisbon",
    }).format(new Date(Date.UTC(year!, month! - 1, 15, 12)));
    options.push({ value: selected, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return options;
}

function hrefWith(current: URLSearchParams, patch: Record<string, string | null>) {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(patch)) {
    if (!value) next.delete(key);
    else next.set(key, value);
  }
  const query = next.toString();
  return query ? `/transacoes?${query}` : "/transacoes";
}

async function TransacoesContent({ searchParams }: { searchParams: SearchParams }) {
  await ensureRequestDynamic();
  const flash = await readPageFlash();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const params = await searchParams;
  const [data, unseenCount] = await Promise.all([
    getTransactionsPage(user.id, selected.id, params),
    countUnseenFinancialAlerts(user.id, selected.id),
  ]);
  if (!data) redirect("/inicio");

  const query = new URLSearchParams();
  if (data.filters.q) query.set("q", data.filters.q);
  if (data.filters.accountId) query.set("accountId", data.filters.accountId);
  if (data.filters.categoryId) query.set("categoryId", data.filters.categoryId);
  if (data.filters.type) query.set("type", data.filters.type);
  if (data.period) query.set("period", data.period);
  else {
    query.set("from", data.from);
    query.set("to", data.to);
  }
  const showReview = params.review === "1";
  const today = civilDateFromInstant(new Date());
  const months = monthOptions(today, data.period);

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
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Transações</h1>
          <p className="mt-0.5 text-sm text-slate-500">Todas as tuas movimentações financeiras num só lugar.</p>
        </div>
      }
      headerActions={<NewTransactionDrawer accounts={data.accounts} categories={data.categories} />}
    >
      <p className="mb-4 text-xs text-slate-500">
        Indicadores, gráficos e tabela usam o mesmo período e os mesmos filtros. As transferências não entram nas
        entradas nem nas saídas económicas.{" "}
        <Link
          href={hrefWith(query, { review: showReview ? null : "1" })}
          className="font-medium text-blue-600 hover:underline"
        >
          {showReview ? "Ocultar revisão de categorias" : "Revisão de categorias"}
        </Link>
      </p>
      <CategorizationReviewPanel open={showReview} />
      <TransactionsFilters
        period={data.period}
        months={months}
        from={data.from}
        to={data.to}
        q={data.filters.q}
        accountId={data.filters.accountId}
        categoryId={data.filters.categoryId}
        type={data.filters.type}
        accounts={data.accounts}
        categories={data.categories}
        showReview={showReview}
      />
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardKpiCard label="Entradas" value={data.kpis.income} tone="income" icon="↑" />
        <DashboardKpiCard label="Saídas" value={data.kpis.expense} tone="expense" icon="↓" />
        <DashboardKpiCard label="Resultado económico" value={data.kpis.result} tone="accent" icon="=" />
        <DashboardKpiCard
          label="Total de transações"
          value={String(data.kpis.count)}
          rawValue
          tone="analytic"
          icon="#"
          trendLabel="No período filtrado, não só nesta página"
        />
      </div>

      <div className="mt-5">
        <TransactionCharts
          daily={data.daily}
          categories={data.categoriesBreakdown}
          expenseTotal={data.kpis.expense}
        />
      </div>

      <section className="mt-5 min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
        {data.rows.length === 0 ? (
          <p className="mt-6 text-sm text-slate-600">Nenhum movimento corresponde a estes filtros.</p>
        ) : (
          <FinanceTable caption="Movimentos do período" className="mt-4">
            <FinanceTableHead>
              <FinanceTableHeaderCell>Data</FinanceTableHeaderCell>
              <FinanceTableHeaderCell>Descrição</FinanceTableHeaderCell>
              <FinanceTableHeaderCell>Categoria</FinanceTableHeaderCell>
              <FinanceTableHeaderCell>Conta</FinanceTableHeaderCell>
              <FinanceTableHeaderCell align="right">Valor</FinanceTableHeaderCell>
              <FinanceTableHeaderCell>Tipo</FinanceTableHeaderCell>
              <FinanceTableHeaderCell>Ações</FinanceTableHeaderCell>
            </FinanceTableHead>
            <FinanceTableBody>
              {data.rows.map((row) => {
                const tone =
                  row.type === "TRANSFER" || row.type === "ADJUSTMENT"
                    ? "text-slate-700"
                    : decimal(row.amount).gte(0)
                      ? "text-emerald-700"
                      : "text-rose-700";
                return (
                  <FinanceTableRow key={row.id}>
                    <FinanceTableCell>
                      {formatCivilDate(civilDateFromInstant(new Date(row.occurredAt)))}
                    </FinanceTableCell>
                    <FinanceTableCell className="max-w-[220px] truncate">
                      {row.description ?? "—"}
                    </FinanceTableCell>
                    <FinanceTableCell>
                      {row.categoryName ? <StatusBadge variant="muted">{row.categoryName}</StatusBadge> : "—"}
                    </FinanceTableCell>
                    <FinanceTableCell>{row.accountName}</FinanceTableCell>
                    <FinanceTableCell align="right" className={`font-medium ${tone}`}>
                      {formatEUR(row.amount)}
                    </FinanceTableCell>
                    <FinanceTableCell>{typeBadge(row.type)}</FinanceTableCell>
                    <FinanceTableCell>
                      <Link href={`/contas/${row.accountId}`} className="text-sm font-medium text-blue-600 hover:underline">
                        Ver conta
                      </Link>
                    </FinanceTableCell>
                  </FinanceTableRow>
                );
              })}
            </FinanceTableBody>
          </FinanceTable>
        )}

        {data.pageCount > 1 ? (
          <div className="mt-4 flex items-center justify-between text-sm">
            <p className="text-slate-500">
              Página {data.page} de {data.pageCount}
            </p>
            <div className="flex gap-3">
              {data.page > 1 ? (
                <Link href={hrefWith(query, { page: String(data.page - 1) })} className="text-blue-700 hover:underline">
                  Anterior
                </Link>
              ) : null}
              {data.page < data.pageCount ? (
                <Link href={hrefWith(query, { page: String(data.page + 1) })} className="text-blue-700 hover:underline">
                  Seguinte
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}

export default function TransacoesPage(props: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSuspenseFallback shape="transactions" />}>
      <TransacoesContent searchParams={props.searchParams} />
    </Suspense>
  );
}
