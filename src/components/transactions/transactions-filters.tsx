import Link from "next/link";
import { MonthFilterSelect } from "@/components/transactions/month-filter-select";

const fieldClassName =
  "h-9 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30";

type Option = { id: string; name: string };

export function TransactionsFilters({
  period,
  months,
  from,
  to,
  q,
  accountId,
  categoryId,
  type,
  accounts,
  categories,
  showReview,
}: {
  period: string;
  months: { value: string; label: string }[];
  from: string;
  to: string;
  q: string;
  accountId: string;
  categoryId: string;
  type: string;
  accounts: Option[];
  categories: Option[];
  showReview: boolean;
}) {
  const advancedOpen = Boolean(q || accountId || categoryId || type || !period);

  return (
    <form method="get" className="mb-4 min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="w-full min-w-[10rem] sm:w-auto sm:min-w-[11rem]">
          <MonthFilterSelect value={period} options={months} className={fieldClassName} />
        </div>
        <input
          name="q"
          defaultValue={q}
          placeholder="Pesquisar por descrição"
          aria-label="Pesquisar por descrição"
          className={`${fieldClassName} min-w-[10rem] flex-1`}
        />
        <button
          type="submit"
          className="inline-flex h-9 shrink-0 items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/40"
        >
          Filtrar
        </button>
        {showReview ? <input type="hidden" name="review" value="1" /> : null}
      </div>

      <details className="mt-2 group" open={advancedOpen}>
        <summary className="cursor-pointer list-none text-sm font-medium text-slate-600 marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="underline-offset-2 hover:text-blue-600 hover:underline">
            Mais filtros
            {advancedOpen ? " · ativos" : ""}
          </span>
        </summary>
        <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 border-t border-[var(--border)] pt-2 sm:grid-cols-2 lg:grid-cols-4">
          <select name="accountId" defaultValue={accountId} className={fieldClassName} aria-label="Conta">
            <option value="">Todas as contas</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <select name="categoryId" defaultValue={categoryId} className={fieldClassName} aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select name="type" defaultValue={type} className={fieldClassName} aria-label="Tipo">
            <option value="">Todos os tipos</option>
            <option value="INCOME">Receita</option>
            <option value="EXPENSE">Despesa</option>
            <option value="TRANSFER">Transferência</option>
            <option value="ADJUSTMENT">Ajustamento</option>
          </select>
          <div className="flex min-w-0 gap-2 sm:col-span-2 lg:col-span-4">
            <input name="from" type="date" defaultValue={from} className={fieldClassName} aria-label="De" />
            <input name="to" type="date" defaultValue={to} className={fieldClassName} aria-label="Até" />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
            <button type="submit" className="text-sm font-medium text-blue-700 hover:underline">
              Aplicar filtros
            </button>
            <Link href="/transacoes" className="text-sm text-slate-500 hover:underline">
              Limpar filtros
            </Link>
          </div>
        </div>
      </details>
    </form>
  );
}