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
import { createExpenseAction } from "@/lib/finance/income-actions";
import { formatEUR } from "@/lib/finance/money";
import { readPageFlash } from "@/lib/ui/page-shell";
import { listAccountsWithBalances } from "@/server/services/accounts";
import { listExpenses } from "@/server/services/expenses";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

async function DespesasContent() {
  await ensureRequestDynamic();
  const flash = await readPageFlash();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const membership = await requireWorkspaceAccess(user.id, selected.id);
  if (!membership) redirect("/inicio");

  const accounts = (await listAccountsWithBalances(user.id, selected.id)) ?? [];
  const data = await listExpenses(user.id, selected.id);

  return (
    <AppShell
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      flash={flash}
    >
      <PageHeader
        title="Despesas"
        description="Regista despesas concluídas. Montantes em EUR."
      />

      {accounts.length === 0 ? (
        <EmptyState
          title="Sem contas"
          description="Cria uma conta antes de registar despesas."
          action={
            <Link href="/contas" className={primaryButtonClassName}>
              Ir para contas
            </Link>
          }
        />
      ) : (
        <Card title="Nova despesa" className="mt-8">
          <form action={createExpenseAction} className="grid max-w-md gap-4">
            <label className={labelClassName}>
              Conta
              <select name="accountId" required className={inputClassName}>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Categoria
              <select name="categoryId" className={inputClassName}>
                <option value="">Sem categoria</option>
                {data?.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Descrição
              <input name="description" required className={inputClassName} aria-label="Descrição" />
            </label>
            <label className={labelClassName}>
              Montante (EUR)
              <input name="amount" inputMode="decimal" required className={inputClassName} aria-label="Montante (EUR)" />
            </label>
            <button type="submit" className={primaryButtonClassName}>
              Registar despesa
            </button>
          </form>
        </Card>
      )}

      <Card title="Recentes" className="mt-8">
        {data?.transactions.length ? (
          <ul className="flex flex-col gap-2">
            {data.transactions.map((tx) => (
              <li
                key={tx.id}
                className="flex flex-wrap justify-between gap-2 rounded-lg border border-zinc-100 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <span>
                  {tx.account.name}
                  {tx.category ? ` · ${tx.category.name}` : ""} · {tx.description}
                </span>
                <span className="font-medium tabular-nums">{formatEUR(tx.amount.toString())}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Sem despesas"
            description="As despesas registadas aparecem aqui."
          />
        )}
      </Card>
    </AppShell>
  );
}

export default function DespesasPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">A carregar despesas…</p>}>
      <DespesasContent />
    </Suspense>
  );
}
