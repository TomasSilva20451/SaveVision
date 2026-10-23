import Link from "next/link";
import {
  FinanceTable,
  FinanceTableBody,
  FinanceTableCell,
  FinanceTableHead,
  FinanceTableHeaderCell,
  FinanceTableRow,
} from "@/components/ui/finance-table";
import {
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/ui/form-styles";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import {
  civilDateFromInstant,
  formatCivilDateIso,
} from "@/lib/datetime/civil-date";
import {
  confirmRecurringExpenseAction,
  endRecurringExpenseAction,
  pauseRecurringExpenseAction,
  postponeRecurringExpenseAction,
  skipRecurringExpenseAction,
  restoreRecurringExpenseOccurrenceAction,
  updateRecurringAmountAction,
  updateRecurringLiabilityLinkAction,
} from "@/lib/finance/recurring-expense-actions";
import { formatEUR } from "@/lib/finance/money";
import {
  paymentAccountLabel,
  preferredPaymentAccountId,
  sortPaymentAccounts,
} from "@/lib/finance/payment-account";

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

function nextPending(series: Series) {
  return series.occurrences
    .filter((occurrence) => occurrence.status === "EXPECTED" || occurrence.status === "POSTPONED")
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0] ?? null;
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
              const next = nextPending(series);
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
                  <FinanceTableCell>
                    <details className="group relative">
                      <summary className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-lg border border-[var(--border)] text-lg text-slate-600 hover:bg-slate-50" aria-label={`Ações de ${series.name}`}>
                        ⋮
                      </summary>
                      <div className="absolute right-0 z-20 mt-2 w-80 max-w-[80vw] space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gerir recorrência</p>
                        <div className="flex flex-wrap gap-2">
                          {series.status !== "ENDED" ? (
                            <form action={pauseRecurringExpenseAction}>
                              <input type="hidden" name="seriesId" value={series.id} />
                              {series.status === "PAUSED" ? <input type="hidden" name="resume" value="1" /> : null}
                              <button type="submit" className={secondaryButtonClassName}>{series.status === "PAUSED" ? "Retomar" : "Pausar"}</button>
                            </form>
                          ) : null}
                          {series.status !== "ENDED" ? (
                            <form action={endRecurringExpenseAction}>
                              <input type="hidden" name="seriesId" value={series.id} />
                              <button type="submit" className={secondaryButtonClassName}>Terminar</button>
                            </form>
                          ) : null}
                        </div>
                        <form action={updateRecurringAmountAction} className="space-y-2 border-t border-[var(--border)] pt-3">
                          <input type="hidden" name="seriesId" value={series.id} />
                          <label className="block text-xs font-medium text-slate-600">
                            Valor futuro
                            <input name="expectedAmount" inputMode="decimal" defaultValue={series.expectedAmount.toString()} className={`${inputClassName} mt-1`} />
                          </label>
                          <button type="submit" className={secondaryButtonClassName}>Atualizar valor</button>
                        </form>
                        <form action={updateRecurringLiabilityLinkAction} className="space-y-2 border-t border-[var(--border)] pt-3" data-testid="recurring-liability-link-form">
                          <input type="hidden" name="seriesId" value={series.id} />
                          <label className="block text-xs font-medium text-slate-600">
                            Passivo associado
                            <select name="linkedLiabilityId" defaultValue={series.linkedLiabilityId ?? ""} className={`${inputClassName} mt-1`}>
                              <option value="">— Nenhum —</option>
                              {liabilities.map((liability) => <option key={liability.id} value={liability.id}>{liability.title}</option>)}
                            </select>
                          </label>
                          <button type="submit" className={secondaryButtonClassName}>Guardar associação</button>
                        </form>
                        {next && accounts.length > 0 ? (
                          <div className="space-y-3 border-t border-[var(--border)] pt-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Próxima ocorrência</p>
                            <form action={confirmRecurringExpenseAction} className="space-y-2">
                              <input type="hidden" name="occurrenceId" value={next.id} />
                              <input type="hidden" name="idempotencyKey" value={`pay-${next.id}`} />
                              <input type="hidden" name="paidAt" value={now.toISOString()} />
                              <select name="accountId" required defaultValue={preferredAccountId} aria-label="Conta do pagamento" className={`${inputClassName} mt-0`}>
                                {paymentAccounts.map((account) => <option key={account.id} value={account.id}>{paymentAccountLabel(account)}</option>)}
                              </select>
                              <p className="text-xs text-slate-500">Conta à ordem preferida automaticamente; poupança só por escolha explícita.</p>
                              <input name="actualAmount" inputMode="decimal" defaultValue={next.expectedAmount.toString()} aria-label="Valor pago" className={`${inputClassName} mt-0`} />
                              {series.linkedLiabilityId ? (
                                <label className="flex items-start gap-2 text-xs text-amber-800">
                                  <input type="checkbox" name="acknowledgeLinkedLiabilityRisk" className="mt-0.5" data-testid="ack-linked-liability-recurring" />
                                  Compreendo o risco de duplicar a saída se registar também o pagamento do passivo.
                                </label>
                              ) : null}
                              <button type="submit" className={primaryButtonClassName}>Confirmar pagamento</button>
                            </form>
                            <form action={postponeRecurringExpenseAction} className="flex items-end gap-2">
                              <input type="hidden" name="occurrenceId" value={next.id} />
                              <input name="newDueDate" type="date" required min={formatCivilDateIso(civilDateFromInstant(now))} aria-label="Nova data" className={`${inputClassName} mt-0 min-w-0`} />
                              <button type="submit" className={secondaryButtonClassName}>Adiar</button>
                            </form>
                            <form action={skipRecurringExpenseAction}>
                              <input type="hidden" name="occurrenceId" value={next.id} />
                              <button type="submit" className="text-sm font-medium text-rose-700 hover:underline">Ignorar ocorrência</button>
                            </form>
                          </div>
                        ) : null}
                      </div>
                    </details>
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
              const amount = occurrence.actualAmount ?? occurrence.expectedAmount;
              return (
                <li key={occurrence.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{occurrence.recurringExpense.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {shortDate(occurrence.dueDate)} · {formatEUR(amount.toString())}
                      {wasPaid && occurrence.transaction ? ` · ${occurrence.transaction.account.name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge variant={wasPaid ? "success" : "muted"}>{wasPaid ? "Pago" : "Ignorada"}</StatusBadge>
                    <form action={restoreRecurringExpenseOccurrenceAction}>
                      <input type="hidden" name="occurrenceId" value={occurrence.id} />
                      <ConfirmSubmitButton
                        confirmMessage={wasPaid
                          ? `Anular este pagamento de ${formatEUR(amount.toString())}? O saldo será reposto em ${occurrence.transaction?.account.name ?? "a conta debitada"}.`
                          : "Repor esta ocorrência como pendente?"}
                        pendingLabel="A repor…"
                        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-50 hover:shadow-sm disabled:opacity-60 dark:text-rose-300 dark:hover:bg-rose-950/40"
                      >
                        {wasPaid ? "Anular pagamento" : "Repor ocorrência"}
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
