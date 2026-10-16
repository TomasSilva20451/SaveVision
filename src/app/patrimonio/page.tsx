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
} from "@/components/ui/form-styles";
import { PageHeader } from "@/components/ui/page-header";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import {
  createLiabilityAction,
  captureNetWorthSnapshotAction,
  recordLiabilityPaymentAction,
  updateLiabilityScheduleAction,
} from "@/lib/finance/patrimony-actions";
import { formatEUR } from "@/lib/finance/money";
import { readPageFlash } from "@/lib/ui/page-shell";
import { getPatrimonyOverview } from "@/server/services/patrimony";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

async function PatrimonioContent() {
  await ensureRequestDynamic();
  const flash = await readPageFlash();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const membership = await requireWorkspaceAccess(user.id, selected.id);
  if (!membership) redirect("/inicio");

  const data = await getPatrimonyOverview(user.id, selected.id);
  if (!data) redirect("/inicio");

  return (
    <AppShell
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      flash={flash}
    >
      <PageHeader
        title="Património"
        description="Ativos (contas e investimentos manuais) menos passivos registados. Objetivos de poupança não contam como ativos extra."
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Património líquido">
          <p className="text-2xl font-semibold">{formatEUR(data.netPatrimony)}</p>
        </Card>
        <Card title="Contas (incl. poupança)">
          <p className="text-2xl font-semibold">{formatEUR(data.accountNetWorthFromEngine)}</p>
        </Card>
        <Card title="Investimentos (manual)">
          <p className="text-2xl font-semibold">{formatEUR(data.investmentsValue)}</p>
        </Card>
        <Card title="Passivos">
          <p className="text-2xl font-semibold">{formatEUR(data.manualLiabilities)}</p>
        </Card>
      </div>

      <Card title="Contas" className="mt-8">
        {data.accounts.length === 0 ? (
          <EmptyState
            title="Sem contas"
            description="Cria contas para ver saldos agregados."
            action={
              <Link href="/contas" className={primaryButtonClassName}>
                Ir para contas
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {data.accounts.map((account) => (
              <li key={account.id} className="flex justify-between gap-4">
                <span>
                  {account.name} · {account.type}
                </span>
                <span className="font-medium">{formatEUR(account.balance)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Posições de investimento" className="mt-6">
        {data.investments.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Sem posições.{" "}
            <Link href="/investimentos" className="underline">
              Registar investimentos
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {data.investments.map((row) => (
              <li key={row.id} className="flex justify-between gap-4">
                <span>
                  {row.symbol} · {row.name}
                </span>
                <span className="font-medium">{formatEUR(row.marketValue)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Nova responsabilidade" className="mt-8">
        <form action={createLiabilityAction} className="grid max-w-lg gap-4">
          <label className={labelClassName}>
            Título
            <input name="title" required className={inputClassName} />
          </label>
          <label className={labelClassName}>
            Tipo
            <select name="type" className={inputClassName}>
              <option value="PERSONAL_LOAN">Crédito pessoal</option>
              <option value="AUTO_LOAN">Crédito automóvel</option>
              <option value="MORTGAGE">Crédito habitação</option>
              <option value="FAMILY_LOAN">Empréstimo familiar</option>
              <option value="OTHER">Outro</option>
            </select>
          </label>
          <label className={labelClassName}>
            Saldo em dívida (EUR)
            <input name="outstandingBalance" required className={inputClassName} />
          </label>
          <label className={labelClassName}>
            Prestação mensal (opcional)
            <input name="monthlyPayment" className={inputClassName} />
          </label>
          <label className={labelClassName}>
            Dia de vencimento da prestação (1–31, opcional)
            <input
              name="paymentDueDayOfMonth"
              type="number"
              min={1}
              max={31}
              className={inputClassName}
              data-testid="liability-due-day-create"
            />
          </label>
          <p className="text-xs text-zinc-500">
            Meses mais curtos usam o último dia válido (ex.: 31 → 28/29 em fevereiro). Sem dia
            definido, a prestação não entra nas previsões (salvo via recorrência associada).
          </p>
          <label className={labelClassName}>
            Taxa manual % (opcional)
            <input name="manualRatePercent" className={inputClassName} />
          </label>
          <label className={labelClassName}>
            Notas
            <textarea name="notes" rows={2} className={inputClassName} />
          </label>
          <button type="submit" className={primaryButtonClassName}>
            Criar responsabilidade
          </button>
        </form>
      </Card>

      <Card title="Histórico patrimonial" className="mt-6">
        <form action={captureNetWorthSnapshotAction}>
          <button type="submit" className={primaryButtonClassName}>
            Registar snapshot (hoje)
          </button>
        </form>
        {(data.snapshots?.length ?? 0) >= 2 ? (
          <ul className="mt-4 flex flex-col gap-1 text-sm">
            {data.snapshots.map((snap) => (
              <li key={snap.id}>
                {snap.asOfDate.toLocaleDateString("pt-PT")} · PL{" "}
                {formatEUR(snap.netWorth.toString())}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">
            Regista pelo menos dois snapshots para ver evolução (sem inventar histórico).
          </p>
        )}
      </Card>

      <Card title="Responsabilidades" className="mt-6">
        {data.liabilities.length === 0 ? (
          <EmptyState title="Sem passivos registados" description="Regista empréstimos ou créditos manualmente." />
        ) : (
          <ul className="flex flex-col gap-6">
            {data.liabilities.map((liability) => (
              <li key={liability.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <p className="font-medium">{liability.title}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {liability.type} · Saldo: {formatEUR(liability.outstandingBalance)}
                  {liability.monthlyPayment
                    ? ` · Prestação: ${formatEUR(liability.monthlyPayment)}`
                    : null}
                  {liability.paymentDueDayOfMonth
                    ? ` · Vencimento: dia ${liability.paymentDueDayOfMonth}`
                    : liability.monthlyPayment
                      ? " · Vencimento: não definido"
                      : null}
                </p>
                {liability.monthlyPayment && !liability.paymentDueDayOfMonth ? (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                    Defina o dia de vencimento para incluir esta prestação nas previsões.
                  </p>
                ) : null}
                <form
                  action={updateLiabilityScheduleAction}
                  className="mt-3 flex flex-wrap items-end gap-2"
                  data-testid="liability-due-day-form"
                >
                  <input type="hidden" name="liabilityId" value={liability.id} />
                  <label className={labelClassName}>
                    Dia de vencimento
                    <input
                      name="paymentDueDayOfMonth"
                      type="number"
                      min={1}
                      max={31}
                      defaultValue={liability.paymentDueDayOfMonth ?? ""}
                      className={inputClassName}
                    />
                  </label>
                  <button type="submit" className={primaryButtonClassName}>
                    Guardar vencimento
                  </button>
                  {liability.paymentDueDayOfMonth ? (
                    <button
                      type="submit"
                      name="clearDueDay"
                      value="1"
                      className={primaryButtonClassName}
                    >
                      Remover vencimento
                    </button>
                  ) : null}
                </form>
                <form action={recordLiabilityPaymentAction} className="mt-4 grid max-w-md gap-2">
                  <input type="hidden" name="liabilityId" value={liability.id} />
                  <label className={labelClassName}>
                    Capital amortizado
                    <input name="principalAmount" defaultValue="0" className={inputClassName} />
                  </label>
                  <label className={labelClassName}>
                    Juros (despesa possível)
                    <input name="interestAmount" defaultValue="0" className={inputClassName} />
                  </label>
                  <label className={labelClassName}>
                    Outros encargos
                    <input name="feesAmount" defaultValue="0" className={inputClassName} />
                  </label>
                  <label className={labelClassName}>
                    Data
                    <input name="paidAt" type="date" className={inputClassName} />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="recordBankMovement" />
                    Registar movimento bancário (atómico)
                  </label>
                  <label className={labelClassName}>
                    Conta (se movimento bancário)
                    <select name="accountId" className={inputClassName}>
                      <option value="">—</option>
                      {data.accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {liability.hasActiveLinkedRecurring ? (
                    <label className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
                      <input
                        type="checkbox"
                        name="acknowledgeLinkedLiabilityRisk"
                        className="mt-0.5"
                        data-testid="ack-linked-liability-payment"
                      />
                      Compreendo que existe uma recorrência associada a este passivo e que um
                      movimento bancário aqui pode duplicar a saída se a recorrência também
                      tiver sido confirmada com movimento.
                    </label>
                  ) : null}
                  <button type="submit" className={primaryButtonClassName}>
                    Registar pagamento
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-6 text-sm text-zinc-500">
        A amortização de capital reduz caixa e passivo com impacto nulo no património líquido (antes de
        juros). Regista juros como despesa em{" "}
        <Link href="/despesas" className="underline">
          despesas
        </Link>{" "}
        se aplicável.
      </p>
    </AppShell>
  );
}

export default function PatrimonioPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">A carregar património…</p>}>
      <PatrimonioContent />
    </Suspense>
  );
}
