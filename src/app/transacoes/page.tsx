import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { inputClassName, labelClassName, primaryButtonClassName } from "@/components/ui/form-styles";
import { PageHeader } from "@/components/ui/page-header";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { readPageFlash } from "@/lib/ui/page-shell";
import { createTransferAction } from "@/lib/finance/actions";
import { formatEUR } from "@/lib/finance/money";
import { db } from "@/lib/db";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";
import { listAccountsWithBalances } from "@/server/services/accounts";

async function TransacoesContent() {
  await ensureRequestDynamic();
  const flash = await readPageFlash();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const membership = await requireWorkspaceAccess(user.id, selected.id);
  if (!membership) redirect("/inicio");

  const accounts =
    (await listAccountsWithBalances(user.id, selected.id)) ?? [];

  const transactions = await db.transaction.findMany({
    where: { workspaceId: selected.id, deletedAt: null },
    orderBy: { occurredAt: "desc" },
    take: 50,
    include: { account: { select: { name: true } } },
  });

  return (
    <AppShell
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      flash={flash}
    >
      <PageHeader title="Transações" description="Últimos movimentos e transferências internas." />
      <ul className="mt-6 flex flex-col gap-2">
        {transactions.map((tx) => (
          <li
            key={tx.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
          >
            <span>
              {tx.account.name} · {tx.type} · {tx.description ?? "—"}
            </span>
            <span>{formatEUR(tx.amount.toString())}</span>
          </li>
        ))}
      </ul>
      {accounts.length >= 2 ? (
        <Card title="Transferência entre contas" className="mt-8">
          <form action={createTransferAction} className="grid gap-3 sm:max-w-md">
            <label className={labelClassName}>
              De
              <select name="fromAccountId" required className={inputClassName}>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Para
              <select name="toAccountId" required className={inputClassName}>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Montante (EUR)
              <input name="amount" required placeholder="500" className={inputClassName} />
            </label>
            <label className={labelClassName}>
              Descrição
              <input name="description" className={inputClassName} />
            </label>
            <button type="submit" className={primaryButtonClassName}>
              Registar transferência
            </button>
          </form>
        </Card>
      ) : null}
    </AppShell>
  );
}

export default function TransacoesPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">A carregar transações…</p>}>
      <TransacoesContent />
    </Suspense>
  );
}
