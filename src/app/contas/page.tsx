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
import { readPageFlash } from "@/lib/ui/page-shell";
import { createAccountAction } from "@/lib/finance/actions";
import { formatEUR } from "@/lib/finance/money";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";
import { listAccountsWithBalances } from "@/server/services/accounts";

async function ContasContent() {
  await ensureRequestDynamic();
  const flash = await readPageFlash();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) {
    return (
      <AppShell userName={user.name} workspaces={workspaces} activeWorkspaceId={null}>
        <p>Corre `pnpm db:seed` para criar workspaces pessoais.</p>
      </AppShell>
    );
  }

  const accounts =
    (await listAccountsWithBalances(user.id, selected.id)) ?? [];

  return (
    <AppShell
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      flash={flash}
    >
      <div className="flex flex-col gap-8">
        <PageHeader title="Contas" description={`Espaço: ${selected.name}`} />
        <ul className="grid gap-3 sm:grid-cols-2">
          {accounts.map((account) => (
            <li key={account.id}>
              <Link
                href={`/contas/${account.id}`}
                className="block rounded-xl border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <p className="font-medium">{account.name}</p>
                <p className="text-sm text-zinc-500">{account.type}</p>
                <p className="mt-2 text-lg">{formatEUR(account.currentBalance)}</p>
              </Link>
            </li>
          ))}
        </ul>
        {accounts.length === 0 ? (
          <EmptyState
            title="Sem contas"
            description="Cria a primeira conta para registar movimentos."
          />
        ) : null}
        <Card title="Nova conta">
          <form action={createAccountAction} className="grid gap-3 sm:max-w-md">
            <label className={labelClassName}>
              Nome
              <input name="name" required className={inputClassName} />
            </label>
            <label className={labelClassName}>
              Tipo
              <select name="type" className={inputClassName}>
                <option value="CURRENT">Conta à ordem</option>
                <option value="SAVINGS">Poupança</option>
                <option value="CASH">Dinheiro</option>
              </select>
            </label>
            <label className={labelClassName}>
              Saldo inicial (EUR)
              <input name="openingBalance" defaultValue="0" required className={inputClassName} />
            </label>
            <button type="submit" className={primaryButtonClassName}>
              Criar conta
            </button>
          </form>
        </Card>
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
