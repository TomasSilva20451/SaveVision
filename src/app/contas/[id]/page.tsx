import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { readPageFlash } from "@/lib/ui/page-shell";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { calculateAccountBalance } from "@/lib/finance/aggregates";
import { formatEUR } from "@/lib/finance/money";
import { db } from "@/lib/db";
import { listWorkspaceMovements } from "@/server/repositories/ledger";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

type PageProps = { params: Promise<{ id: string }> };

async function ContaDetailContent({ accountId }: { accountId: string }) {
  await ensureRequestDynamic();
  const flash = await readPageFlash();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const account = await db.financialAccount.findUnique({ where: { id: accountId } });
  if (!account) notFound();

  const membership = await requireWorkspaceAccess(user.id, account.workspaceId);
  if (!membership) notFound();

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  const movements = await listWorkspaceMovements(account.workspaceId);
  const balance = calculateAccountBalance(
    account.openingBalance.toString(),
    movements,
    account.id,
  );

  const transactions = await db.transaction.findMany({
    where: { accountId, deletedAt: null },
    orderBy: { occurredAt: "desc" },
    take: 50,
  });

  return (
    <AppShell
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected?.id ?? null}
      flash={flash}
    >
      <h1 className="text-2xl font-semibold">{account.name}</h1>
      <p className="mt-2 text-lg">{formatEUR(balance.toFixed(2))}</p>
      <ul className="mt-6 flex flex-col gap-2">
        {transactions.map((tx) => (
          <li
            key={tx.id}
            className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
          >
            <span>
              {tx.type} · {tx.description ?? "—"}
            </span>
            <span>{formatEUR(tx.amount.toString())}</span>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}

async function ContaDetailRoute({ params }: PageProps) {
  const { id } = await params;
  return <ContaDetailContent accountId={id} />;
}

export default function ContaDetailPage({ params }: PageProps) {
  return (
    <Suspense fallback={<p className="p-6 text-sm">A carregar conta…</p>}>
      <ContaDetailRoute params={params} />
    </Suspense>
  );
}
