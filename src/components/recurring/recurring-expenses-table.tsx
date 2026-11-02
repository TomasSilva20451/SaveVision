import Link from "next/link";
import {
  FinanceTable,
  FinanceTableBody,
  FinanceTableCell,
  FinanceTableHead,
  FinanceTableHeaderCell,
  FinanceTableRow,
} from "@/components/ui/finance-table";
import { inputClassName, secondaryButtonClassName } from "@/components/ui/form-styles";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { civilDateFromInstant } from "@/lib/datetime/civil-date";
import { restoreRecurringExpenseOccurrenceAction } from "@/lib/finance/recurring-expense-actions";
import { RecurringSeriesActionsMenu } from "@/components/recurring/recurring-series-actions-menu";
import { formatEUR } from "@/lib/finance/money";
import { preferredPaymentAccountId, sortPaymentAccounts } from "@/lib/finance/payment-account";

const FREQUENCY_LABEL: Record<string, string> = {
  WEEKLY: "Semanal",
  BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  YEARLY: "Anual",
};

const CATEGORY_TONES = [
  "bg-blue-50 text-blue-700",
  "bg-amber-50 text-amber-800",
  "bg-emerald-50 text-emerald-700",
  "bg-violet-50 text-violet-700",
  "bg-rose-50 text-rose-700",
  "bg-cyan-50 text-cyan-700",
];

type Occurrence = {
  id: string;
  dueDate: Date;
  expectedAmount: { toString(): string };
  actualAmount: { toString(): string } | null;
  status: string;
};

type Series = {
  id: string;
  name: string;
  categoryId: string;
  expectedAmount: { toString(): string };
  frequency: string;
  status: string;
  linkedLiabilityId: string | null;
  accountId: string | null;
  category: { name: string };
  linkedLiability: { title: string } | null;
  occurrences: Occurrence[];
};

type HistoryOccurrence = {
  id: string;
  dueDate: Date;
  expectedAmount: { toString(): string };
  actualAmount: { toString(): string } | null;
  status: string;
  recurringExpense: { name: string };
  transaction: {
    deletedAt: Date | null;
    account: { name: string; type: string };
  } | null;
};

function statusPresentation(status: string) {
  if (status === "ACTIVE") return { label: "Ativa", variant: "success" as const };
  if (status === "PAUSED") return { label: "Em pausa", variant: "warning" as const };
  return { label: "Terminada", variant: "muted" as const };
}

function civilDayNumber(date: Date) {
  const civil = civilDateFromInstant(date);
  return Math.floor(Date.UTC(civil.year, civil.month - 1, civil.day) / 86_400_000);
}

function relativeDueLabel(dueDate: Date, now: Date) {
  const days = civilDayNumber(dueDate) - civilDayNumber(now);
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Amanhã";
  if (days > 1) return `Em ${days} dias`;
  if (days === -1) return "Vencida há 1 dia";
  return `Vencida há ${Math.abs(days)} dias`;
}

function shortDate(date: Date) {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(date)
    .replace(" de ", " ")
    .replace(".", "");
}

/** Próxima ocorrência relevante: a primeira com vencimento hoje ou no futuro; senão a menos antiga em atraso. */
function nextPending(series: Series, now: Date) {
  const pending = series.occurrences
    .filter((occurrence) => occurrence.status === "EXPECTED" || occurrence.status === "POSTPONED")
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  if (pending.length === 0) return null;
  const today = civilDayNumber(now);
  const upcoming = pending.find((occurrence) => civilDayNumber(occurrence.dueDate) >= today);
  if (upcoming) return upcoming;
  return pending[pending.length - 1] ?? null;
}

function filterHref(status: string, query: string, categoryId: string) {
  const params = new URLSearchParams();
  if (status !== "ALL") params.set("status", status);
  if (query) params.set("q", query);
  if (categoryId) params.set("category", categoryId);
  const search = params.toString();
  return `/despesas-recorrentes${search ? `?${search}` : ""}`;
}

export function RecurringExpensesTable({
  allSeries,
  visibleSeries,
  categories,
  accounts,
  liabilities,
  history,
  query,
  categoryId,
  status,
  now,
}: {
  allSeries: Series[];
  visibleSeries: Series[];
  categories: { id: string; name: string }[];
  accounts: { id: string; name: string; type: string }[];
  liabilities: { id: string; title: string }[];
  history: HistoryOccurrence[];
  query: string;
  categoryId: string;
  status: string;
  now: Date;
}) {
  const paymentAccounts = sortPaymentAccounts(accounts);
  const tabs = [
    { value: "ALL", label: "Todas", count: allSeries.length },
    { value: "ACTIVE", label: "Ativas", count: allSeries.filter((item) => item.status === "ACTIVE").length },
    { value: "PAUSED", label: "Pausadas", count: allSeries.filter((item) => item.status === "PAUSED").length },
    { value: "ENDED", label: "Terminadas", count: allSeries.filter((item) => item.status === "ENDED").length },
  ];

  return (
    <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
      <div className="flex min-w-0 flex-col gap-4 border-b border-[var(--border)] px-5 pt-4 lg:flex-row lg:items-end lg:justify-between">
        <nav aria-label="Estado das recorrências" className="flex max-w-full gap-5 overflow-x-auto">
          {tabs.map((tab) => (
            <Link
              key={tab.value}
              href={filterHref(tab.value, query, categoryId)}
              aria-current={status === tab.value ? "page" : undefined}
              className={`shrink-0 border-b-2 pb-3 text-sm font-medium ${
                status === tab.value
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label} ({tab.count})
            </Link>
          ))}
        </nav>
        <form method="get" className="grid min-w-0 gap-2 pb-4 sm:grid-cols-[minmax(12rem,1fr)_auto_auto]">
          {status !== "ALL" ? <input type="hidden" name="status" value={status} /> : null}
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Pesquisar recorrências…"
            aria-label="Pesquisar recorrências por nome"
            className={`${inputClassName} mt-0 min-w-0`}
          />
          <select
            name="category"
            defaultValue={categoryId}
            aria-label="Filtrar por categoria"
            className={`${inputClassName} mt-0 min-w-0`}
          >
            <option value="">Todas as categorias</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <button type="submit" className={secondaryButtonClassName}>Filtrar</button>
        </form>
      </div>

      {visibleSeries.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="font-medium">Ainda não tens despesas recorrentes.</p>
          <p className="mt-1 text-sm text-slate-500">
            {allSeries.length === 0
              ? "Cria a primeira recorrência para começares a acompanhar vencimentos."
              : "Nenhuma recorrência corresponde aos filtros selecionados."}
          </p>
        </div>
      ) : (
        <FinanceTable caption="Despesas recorrentes" className="px-5 pb-2">
          <FinanceTableHead>
            <FinanceTableHeaderCell>Nome</FinanceTableHeaderCell>
            <FinanceTableHeaderCell>Categoria</FinanceTableHeaderCell>
            <FinanceTableHeaderCell align="right">Valor</FinanceTableHeaderCell>
            <FinanceTableHeaderCell>Frequência</FinanceTableHeaderCell>
            <FinanceTableHeaderCell>Próximo vencimento</FinanceTableHeaderCell>
            <FinanceTableHeaderCell>Associação</FinanceTableHeaderCell>
            <FinanceTableHeaderCell>Estado</FinanceTableHeaderCell>
            <FinanceTableHeaderCell>Ações</FinanceTableHeaderCell>
          </FinanceTableHead>
          <FinanceTableBody>
            {visibleSeries.map((series) => {
              const next = nextPending(series, now);
              const state = statusPresentation(series.status);
              const tone = CATEGORY_TONES[Math.abs(series.categoryId.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)) % CATEGORY_TONES.length];
              const preferredAccountId = preferredPaymentAccountId(paymentAccounts, series.accountId);
              return (
                <FinanceTableRow key={series.id}>
                  <FinanceTableCell className="min-w-48 font-medium">
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-700">⌂</span>
                      {series.name}
                    </span>
                  </FinanceTableCell>
                  <FinanceTableCell>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{series.category.name}</span>
                  </FinanceTableCell>
                  <FinanceTableCell align="right" className="font-semibold">{formatEUR(series.expectedAmount.toString())}</FinanceTableCell>
                  <FinanceTableCell>{FREQUENCY_LABEL[series.frequency] ?? series.frequency}</FinanceTableCell>
                  <FinanceTableCell className="min-w-40">
                    {next ? (
                      <div>
                        <p className="whitespace-nowrap">▣ {shortDate(next.dueDate)}</p>
                        <p className={`text-xs ${civilDayNumber(next.dueDate) < civilDayNumber(now) ? "font-medium text-rose-600" : "text-slate-500"}`}>
                          {relativeDueLabel(next.dueDate, now)}{next.status === "POSTPONED" ? " · adiada" : ""}
                        </p>
                      </div>
                    ) : "—"}
                  </FinanceTableCell>
                  <FinanceTableCell className="min-w-36">
                    {series.linkedLiability ? (
                      <span className="inline-flex items-center gap-1 text-violet-700">↗ {series.linkedLiability.title}</span>
                    ) : "—"}
                  </FinanceTableCell>
                  <FinanceTableCell><StatusBadge variant={state.variant}>{state.label}</StatusBadge></FinanceTableCell>
                  <FinanceTableCell className="overflow-visible">
                    <RecurringSeriesActionsMenu
                      series={series}
                      nextOccurrence={next}
                      accounts={accounts}
                      liabilities={liabilities}
                      preferredAccountId={preferredAccountId}
                      now={now}
                    />
                  </FinanceTableCell>
                </FinanceTableRow>
              );
            })}
          </FinanceTableBody>
        </FinanceTable>
      )}

      {history.length > 0 ? (
        <div className="border-t border-[var(--border)] px-5 py-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-50">Histórico recente</h3>
              <p className="mt-1 text-sm text-slate-500">Anula um pagamento ou repõe uma ocorrência ignorada sem apagar o histórico.</p>
            </div>
          </div>
          <ul className="mt-4 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
            {history.slice(0, 8).map((occurrence) => {
              const wasPaid = occurrence.status === "PAID";
              const acknowledged = wasPaid && !occurrence.transaction;
              const amount = occurrence.actualAmount ?? occurrence.expectedAmount;
              return (
                <li key={occurrence.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{occurrence.recurringExpense.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {shortDate(occurrence.dueDate)} · {formatEUR(amount.toString())}
                      {wasPaid && occurrence.transaction ? ` · ${occurrence.transaction.account.name}` : ""}
                      {acknowledged ? " · débito já feito, sem movimento novo" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge variant={wasPaid ? "success" : "muted"}>{wasPaid ? "Pago" : "Ignorada"}</StatusBadge>
                    <form action={restoreRecurringExpenseOccurrenceAction}>
                      <input type="hidden" name="occurrenceId" value={occurrence.id} />
                      <ConfirmSubmitButton
                        confirmMessage={acknowledged
                          ? "Reabrir este mês como por pagar? O saldo da conta não muda."
                          : wasPaid
                            ? `Anular este pagamento de ${formatEUR(amount.toString())}? O saldo será reposto em ${occurrence.transaction?.account.name ?? "a conta debitada"}.`
                            : "Repor esta ocorrência como pendente?"}
                        pendingLabel="A repor…"
                        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-50 hover:shadow-sm disabled:opacity-60 dark:text-rose-300 dark:hover:bg-rose-950/40"
                      >
                        {acknowledged ? "Reabrir mês" : wasPaid ? "Anular pagamento" : "Repor ocorrência"}
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
