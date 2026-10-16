import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
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
  civilDateFromInstant,
  formatCivilDate,
  formatCivilDateIso,
} from "@/lib/datetime/civil-date";
import {
  confirmRecurringExpenseAction,
  createRecurringExpenseAction,
  endRecurringExpenseAction,
  pauseRecurringExpenseAction,
  postponeRecurringExpenseAction,
  skipRecurringExpenseAction,
  updateRecurringAmountAction,
  updateRecurringLiabilityLinkAction,
} from "@/lib/finance/recurring-expense-actions";
import { listWorkspaceLiabilities } from "@/server/services/patrimony";
import { decimal, formatEUR } from "@/lib/finance/money";
import { readPageFlash } from "@/lib/ui/page-shell";
import { listAccountsWithBalances } from "@/server/services/accounts";
import { getRecurringExpensesOverview } from "@/server/services/recurring-expenses";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

const FREQUENCY_LABEL: Record<string, string> = {
  WEEKLY: "Semanal",
  BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  YEARLY: "Anual",
};

function statusLabel(status: string) {
  switch (status) {
    case "EXPECTED":
      return "Pendente";
    case "POSTPONED":
      return "Adiada";
    case "PAID":
      return "Paga";
    case "SKIPPED":
      return "Ignorada";
    case "ACTIVE":
      return "Ativa";
    case "PAUSED":
      return "Pausada";
    case "ENDED":
      return "Terminada";
    default:
      return status;
  }
}

async function RecorrentesContent() {
  await ensureRequestDynamic();
  const flash = await readPageFlash();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const membership = await requireWorkspaceAccess(user.id, selected.id);
  if (!membership) redirect("/inicio");

  const [accounts, overview, liabilities] = await Promise.all([
    listAccountsWithBalances(user.id, selected.id),
    getRecurringExpensesOverview(user.id, selected.id),
    listWorkspaceLiabilities(user.id, selected.id),
  ]);

  if (!overview) redirect("/inicio");

  const accountList = accounts ?? [];
  const todayIso = formatCivilDateIso(overview.calendarMonth);

  return (
    <AppShell
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      flash={flash}
    >
      <PageHeader
        title="Despesas recorrentes"
        description="Obrigações previstas não alteram o saldo até confirmar o pagamento. Valores em EUR · datas civis Europe/Lisbon."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Previsto (mês)">
          <p className="text-2xl font-semibold">{formatEUR(overview.summary.expectedMonth)}</p>
        </Card>
        <Card title="Pago (mês)">
          <p className="text-2xl font-semibold">{formatEUR(overview.summary.paidMonth)}</p>
        </Card>
        <Card title="Por pagar (mês)">
          <p className="text-2xl font-semibold">{formatEUR(overview.summary.unpaidMonth)}</p>
        </Card>
        <Card title="Recorrências ativas">
          <p className="text-2xl font-semibold">{overview.summary.activeCount}</p>
          {overview.upcoming[0] ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Próximo: {formatCivilDate(civilDateFromInstant(overview.upcoming[0].dueDate))} ·{" "}
              {overview.upcoming[0].recurringExpense.name}
            </p>
          ) : null}
        </Card>
      </div>

      {accountList.length === 0 ? (
        <div className="mt-8">
        <EmptyState
          title="Sem contas"
          description="Cria uma conta para associar pagamentos recorrentes."
          action={
            <Link href="/contas" className={primaryButtonClassName}>
              Ir para contas
            </Link>
          }
        />
        </div>
      ) : (
        <Card title="Nova recorrência" className="mt-8">
          <form action={createRecurringExpenseAction} className="grid max-w-lg gap-4">
            <label className={labelClassName}>
              Nome
              <input name="name" required className={inputClassName} placeholder="Internet" />
            </label>
            <label className={labelClassName}>
              Categoria
              <select name="categoryId" required className={inputClassName}>
                {overview.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Valor previsto (EUR)
              <input name="expectedAmount" type="text" required className={inputClassName} />
            </label>
            <label className={labelClassName}>
              Periodicidade
              <select name="frequency" required className={inputClassName}>
                {Object.entries(FREQUENCY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Início
              <input name="startDate" type="date" required defaultValue={todayIso} className={inputClassName} />
            </label>
            <label className={labelClassName}>
              Dia do mês (mensal+)
              <input name="dueDayOfMonth" type="number" min={1} max={31} className={inputClassName} />
            </label>
            <label className={labelClassName}>
              Conta predefinida (opcional)
              <select name="accountId" className={inputClassName}>
                <option value="">—</option>
                {accountList.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Associar a empréstimo/passivo (opcional)
              <select
                name="linkedLiabilityId"
                className={inputClassName}
                data-testid="recurring-liability-link-create"
              >
                <option value="">— Nenhum —</option>
                {(liabilities ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-zinc-500">
              Se a recorrência representa a prestação do passivo, associe-o para evitar dupla
              contagem na previsão de tesouraria.
            </p>
            <button type="submit" className={primaryButtonClassName}>
              Criar recorrência
            </button>
          </form>
        </Card>
      )}

      <Card title="Próximas ocorrências" className="mt-8">
        {overview.upcoming.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Sem vencimentos futuros.</p>
        ) : (
          <ul className="divide-y dark:divide-zinc-800">
            {overview.upcoming.map((occ) => (
              <li key={occ.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{occ.recurringExpense.name}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {formatCivilDate(civilDateFromInstant(occ.dueDate))} ·{" "}
                    {formatEUR(occ.expectedAmount.toString())} ·{" "}
                    {statusLabel(occ.status)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={confirmRecurringExpenseAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="occurrenceId" value={occ.id} />
                    <input
                      type="hidden"
                      name="idempotencyKey"
                      value={`pay-${occ.id}`}
                    />
                    <label className="text-xs">
                      Conta
                      <select
                        name="accountId"
                        required
                        defaultValue={occ.recurringExpense.accountId ?? accountList[0]?.id}
                        className={inputClassName}
                      >
                        {accountList.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs">
                      Valor pago
                      <input
                        name="actualAmount"
                        defaultValue={occ.expectedAmount.toString()}
                        className={inputClassName}
                      />
                    </label>
                    <input type="hidden" name="paidAt" value={new Date().toISOString()} />
                    {occ.recurringExpense.linkedLiabilityId ? (
                      <label className="flex max-w-xs items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
                        <input
                          type="checkbox"
                          name="acknowledgeLinkedLiabilityRisk"
                          className="mt-0.5"
                          data-testid="ack-linked-liability-recurring"
                        />
                        Compreendo que isto cria movimento bancário na recorrência e que um
                        pagamento separado do passivo associado pode duplicar a saída de caixa.
                      </label>
                    ) : null}
                    <button type="submit" className={primaryButtonClassName}>
                      Confirmar pagamento
                    </button>
                  </form>
                  <form action={postponeRecurringExpenseAction} className="flex gap-2">
                    <input type="hidden" name="occurrenceId" value={occ.id} />
                    <input name="newDueDate" type="date" required className={inputClassName} />
                    <button type="submit" className={secondaryButtonClassName}>
                      Adiar
                    </button>
                  </form>
                  <form action={skipRecurringExpenseAction}>
                    <input type="hidden" name="occurrenceId" value={occ.id} />
                    <button type="submit" className={secondaryButtonClassName}>
                      Ignorar
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Calendário (mês civil)" className="mt-8">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1 text-xs">
          {overview.calendarOccurrences
            .filter((o) => {
              const c = civilDateFromInstant(o.dueDate);
              return (
                c.month === overview.calendarMonth.month &&
                c.year === overview.calendarMonth.year
              );
            })
            .map((o) => {
              const day = civilDateFromInstant(o.dueDate).day;
              const tone =
                o.status === "PAID"
                  ? "bg-emerald-100 dark:bg-emerald-900/40"
                  : o.status === "SKIPPED"
                    ? "bg-zinc-200 dark:bg-zinc-800"
                    : o.status === "POSTPONED"
                      ? "bg-amber-100 dark:bg-amber-900/40"
                      : "bg-sky-100 dark:bg-sky-900/40";
              return (
                <div key={o.id} className={`rounded p-1 ${tone}`} title={overview.series.find((s) => s.id === o.recurringExpenseId)?.name}>
                  {day}
                </div>
              );
            })}
        </div>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Legenda: azul previsto · verde pago · âmbar adiado · cinza ignorado.
        </p>
      </Card>

      <Card title="Recorrências" className="mt-8">
        <ul className="divide-y dark:divide-zinc-800">
          {overview.series.map((s) => (
            <li key={s.id} className="py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {s.category.name} · {FREQUENCY_LABEL[s.frequency] ?? s.frequency} ·{" "}
                    {formatEUR(s.expectedAmount.toString())} · {statusLabel(s.status)}
                    {s.linkedLiability
                      ? ` · Passivo: ${s.linkedLiability.title}`
                      : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={pauseRecurringExpenseAction}>
                    <input type="hidden" name="seriesId" value={s.id} />
                    {s.status === "PAUSED" ? (
                      <button type="submit" name="resume" value="1" className={secondaryButtonClassName}>
                        Retomar
                      </button>
                    ) : (
                      <button type="submit" className={secondaryButtonClassName}>
                        Pausar
                      </button>
                    )}
                  </form>
                  <form action={endRecurringExpenseAction}>
                    <input type="hidden" name="seriesId" value={s.id} />
                    <button type="submit" className={secondaryButtonClassName}>
                      Terminar
                    </button>
                  </form>
                </div>
              </div>
              <form
                action={updateRecurringLiabilityLinkAction}
                className="mt-3 flex flex-wrap items-end gap-2"
                data-testid="recurring-liability-link-form"
              >
                <input type="hidden" name="seriesId" value={s.id} />
                <label className={labelClassName}>
                  Passivo associado
                  <select
                    name="linkedLiabilityId"
                    defaultValue={s.linkedLiabilityId ?? ""}
                    className={inputClassName}
                  >
                    <option value="">— Nenhum —</option>
                    {(liabilities ?? []).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className={secondaryButtonClassName}>
                  Guardar associação
                </button>
              </form>
              <form action={updateRecurringAmountAction} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="seriesId" value={s.id} />
                <label className={labelClassName}>
                  Novo valor (futuro)
                  <input name="expectedAmount" defaultValue={s.expectedAmount.toString()} className={inputClassName} />
                </label>
                <button type="submit" className={secondaryButtonClassName}>
                  Atualizar valor futuro
                </button>
              </form>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Histórico recente" className="mt-8 mb-12">
        <ul className="divide-y dark:divide-zinc-800">
          {overview.history.map((o) => {
            const series = overview.series.find((s) => s.id === o.recurringExpenseId);
            const deviation =
              o.status === "PAID" && o.actualAmount
                ? decimal(o.actualAmount.toString()).minus(o.expectedAmount.toString())
                : null;
            return (
              <li key={o.id} className="py-3 text-sm">
                {series?.name} · {formatCivilDate(civilDateFromInstant(o.dueDate))} ·{" "}
                {statusLabel(o.status)}
                {o.actualAmount ? ` · ${formatEUR(o.actualAmount.toString())}` : ""}
                {deviation && !deviation.isZero()
                  ? ` · desvio ${formatEUR(deviation.toFixed(2))}`
                  : ""}
              </li>
            );
          })}
        </ul>
      </Card>
    </AppShell>
  );
}

export default function DespesasRecorrentesPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">A carregar despesas recorrentes…</p>}>
      <RecorrentesContent />
    </Suspense>
  );
}
