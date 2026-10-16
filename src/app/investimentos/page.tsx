import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { readPageFlash } from "@/lib/ui/page-shell";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { createInvestmentPositionAction } from "@/lib/finance/investment-actions";
import { formatEUR } from "@/lib/finance/money";
import { listInvestmentPositions } from "@/server/services/investments";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

async function InvestimentosContent() {
  await ensureRequestDynamic();
  const flash = await readPageFlash();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const membership = await requireWorkspaceAccess(user.id, selected.id);
  if (!membership) redirect("/inicio");

  const positions =
    (await listInvestmentPositions(user.id, selected.id)) ?? [];

  return (
    <AppShell
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      flash={flash}
    >
      <h1 className="text-2xl font-semibold tracking-tight">Investimentos</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Registo manual. Sem trading, chaves privadas ou recomendações garantidas.
      </p>

      <aside className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
        Conteúdo educativo: diversificar, conhecer o risco e usar preços introduzidos manualmente
        apenas como referência pessoal.
      </aside>

      <form action={createInvestmentPositionAction} className="mt-6 grid max-w-md gap-2">
        <select name="assetClass" className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950">
          <option value="STOCK">Ação</option>
          <option value="ETF">ETF</option>
          <option value="BOND">Obrigação</option>
          <option value="FUND">Fundo</option>
          <option value="CRYPTO">Cripto</option>
          <option value="OTHER">Outro</option>
        </select>
        <input name="symbol" placeholder="Ticker" required className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
        <input name="name" placeholder="Nome" required className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
        <input name="quantity" placeholder="Quantidade" required className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
        <input name="costBasis" placeholder="Custo de aquisição (€)" required className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
        <input name="manualPrice" placeholder="Preço manual (€)" required className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
        <button type="submit" className="w-fit rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
          Adicionar posição
        </button>
      </form>

      <ul className="mt-8 flex flex-col gap-3">
        {positions.map((pos) => (
          <li key={pos.id} className="rounded-lg border p-3 dark:border-zinc-800">
            <p className="font-medium">
              {pos.symbol} · {pos.name}
            </p>
            <p className="text-sm">
              Valor: {formatEUR(pos.marketValue)} · P/L: {formatEUR(pos.unrealizedPnl)}
              {pos.returnPercent != null ? ` (${pos.returnPercent} %)` : null}
            </p>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}

export default function InvestimentosPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">A carregar…</p>}>
      <InvestimentosContent />
    </Suspense>
  );
}
