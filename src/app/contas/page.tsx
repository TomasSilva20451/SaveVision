import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccountMark, accountTypeLabel } from "@/components/accounts/account-mark";
import { AccountsCharts } from "@/components/accounts/accounts-charts";
import { AddAccountDrawer } from "@/components/accounts/add-account-drawer";
import { DashboardKpiCard } from "@/components/dashboard/dashboard-kpi-card";
import { AppShell } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FinanceTable,
  FinanceTableBody,
  FinanceTableCell,
  FinanceTableHead,
  FinanceTableHeaderCell,
  FinanceTableRow,
} from "@/components/ui/finance-table";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { civilDateFromInstant, formatCivilDate } from "@/lib/datetime/civil-date";
import { decimal, formatEUR } from "@/lib/finance/money";
import { archiveAccountAction } from "@/lib/finance/actions";
import { readPageFlash } from "@/lib/ui/page-shell";
import { getAccountsPageData } from "@/server/services/accounts";
import { countUnseenFinancialAlerts } from "@/server/services/financial-alerts";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";

function amountClass(type: string, amount: string) {
  if (type === "TRANSFER") return "text-slate-700";
  return decimal(amount).gte(0) ? "text-emerald-700" : "text-rose-700";
}

async function ContasContent() {
  await ensureRequestDynamic();
  const flash = await readPageFlash("/contas");
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) {
    return (
      <AppShell visualTheme="aurora" userName={user.name} workspaces={workspaces} activeWorkspaceId={null}>
        <p>Corre `pnpm db:seed` para criar workspaces pessoais.</p>
      </AppShell>
    );
  }

  const [data, unseenCount] = await Promise.all([
    getAccountsPageData(user.id, selected.id),
    countUnseenFinancialAlerts(user.id, selected.id),
  ]);
  if (!data) redirect("/inicio");

  const { accounts, series, recent, hasMovementHistory } = data;
  const total = accounts.reduce((sum, account) => sum.plus(account.currentBalance), decimal(0));
  const currentTotal = accounts
    .filter((account) => account.type === "CURRENT" || account.type === "CASH")
    .reduce((sum, account) => sum.plus(account.currentBalance), decimal(0));
  const savingsTotal = accounts
    .filter((account) => account.type === "SAVINGS")
    .reduce((sum, account) => sum.plus(account.currentBalance), decimal(0));

  const share = (part: ReturnType<typeof decimal>) =>
    total.gt(0) && part.gte(0)
      ? `${part.div(total).times(100).toDecimalPlaces(1).toFixed(1)}% do total`
      : null;

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
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Contas</h1>
          <p className="mt-0.5 text-sm text-slate-500">Todas as tuas contas bancárias num só lugar.</p>
        </div>
      }
      headerActions={<AddAccountDrawer />}
    >
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardKpiCard label="Saldo total" value={total.toFixed(2)} tone="accent" icon={<AccountMark type="CURRENT" bare />} />
        <DashboardKpiCard
          label="Contas à ordem"
          value={currentTotal.toFixed(2)}
          tone="income"
          icon={<AccountMark type="CURRENT" bare />}
          trendLabel={share(currentTotal)}
          trendPositive
        />
        <DashboardKpiCard
          label="Contas de poupança"
          value={savingsTotal.toFixed(2)}
          tone="analytic"
          icon={<AccountMark type="SAVINGS" bare />}
          trendLabel={share(savingsTotal)}
          trendPositive
        />
        <DashboardKpiCard
          label="Número de contas"
          value={String(accounts.length)}
          rawValue
          tone="expense"
          icon={<AccountMark type="OTHER" bare />}
        />
      </div>

      <div className="mt-5">
        {accounts.length === 0 ? (
          <EmptyState title="Sem contas" description="Adiciona a primeira conta para ver saldos e movimentos." />
        ) : (
          <AccountsCharts
            series={series}
            accounts={accounts}
            total={total.toFixed(2)}
            hasMovementHistory={hasMovementHistory}
          />
        )}
      </div>

      <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-5">
        <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] lg:col-span-3">
          <h2 className="text-base font-semibold">As suas contas</h2>
          <p className="mt-1 text-sm text-slate-500">Resumo de todas as contas bancárias.</p>
          {accounts.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Ainda não há contas neste workspace.</p>
          ) : (
            <FinanceTable caption="Contas do workspace" className="mt-4">
              <FinanceTableHead>
                <FinanceTableHeaderCell>Conta</FinanceTableHeaderCell>
                <FinanceTableHeaderCell>Tipo</FinanceTableHeaderCell>
                <FinanceTableHeaderCell>Instituição</FinanceTableHeaderCell>
                <FinanceTableHeaderCell align="right">Saldo atual</FinanceTableHeaderCell>
                <FinanceTableHeaderCell>Ações</FinanceTableHeaderCell>
              </FinanceTableHead>
              <FinanceTableBody>
                {accounts.map((account) => (
                  <FinanceTableRow key={account.id}>
                    <FinanceTableCell>
                      <div className="flex items-center gap-3">
                        <AccountMark type={account.type} />
                        <Link href={`/contas/${account.id}`} className="font-medium text-slate-900 hover:underline">
                          {account.name}
                        </Link>
                      </div>
                    </FinanceTableCell>
                    <FinanceTableCell>{accountTypeLabel[account.type] ?? account.type}</FinanceTableCell>
                    <FinanceTableCell>{account.institution ?? "—"}</FinanceTableCell>
                    <FinanceTableCell align="right">
                      <span className="text-lg font-semibold" data-testid="account-balance">
                        {formatEUR(account.currentBalance)}
                      </span>
                    </FinanceTableCell>
                    <FinanceTableCell>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Link href={`/contas/${account.id}`} className="rounded-lg px-2 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/50">
                          Ver
                        </Link>
                        <form action={archiveAccountAction}>
                          <input type="hidden" name="accountId" value={account.id} />
                          <ConfirmSubmitButton
                            confirmMessage={`Eliminar a conta «${account.name}» da utilização diária? O histórico será preservado.`}
                            pendingLabel="A eliminar…"
                            className="rounded-lg px-2 py-1.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-60 dark:text-rose-300 dark:hover:bg-rose-950/40"
                          >
                            Eliminar
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    </FinanceTableCell>
                  </FinanceTableRow>
                ))}
              </FinanceTableBody>
            </FinanceTable>
          )}
        </section>

        <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Transações recentes</h2>
            <Link href="/transacoes" className="text-xs font-medium text-blue-600 hover:underline">
              Ver todas →
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Sem movimentos neste workspace.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {recent.map((tx) => (
                <li key={tx.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{tx.description ?? "Movimento"}</p>
                    <p className="truncate text-xs text-slate-500">
                      {[tx.categoryName, tx.accountName].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-slate-500">
                      {formatCivilDate(civilDateFromInstant(new Date(tx.occurredAt)))}
                    </p>
                    <p className={`font-medium tabular-nums ${amountClass(tx.type, tx.amount)}`}>
                      {formatEUR(tx.amount)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

export default function ContasPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">A carregar contas…</p>}>
      <ContasContent />
    </Suspense>
  );
}
