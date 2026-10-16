import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { FinancialInsightsPanel } from "@/components/insights/financial-insights-panel";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { readPageFlash } from "@/lib/ui/page-shell";
import { getFinancialInsightsOverview } from "@/server/services/financial-insights";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

async function AnalisesContent() {
  await ensureRequestDynamic();
  const flash = await readPageFlash();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const membership = await requireWorkspaceAccess(user.id, selected.id);
  if (!membership) redirect("/inicio");

  const overview = await getFinancialInsightsOverview(user.id, selected.id);
  if (!overview) redirect("/inicio");

  return (
    <AppShell
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      flash={flash}
    >
      <h1 className="text-2xl font-semibold tracking-tight">Análises financeiras</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Padrões, tendências e recomendações explicáveis com base nos dados do workspace. Sem
        machine learning.
      </p>

      <div className="mt-8" data-testid="financial-insights-page">
        <FinancialInsightsPanel summary={overview.summary} insights={overview.insights} />
      </div>

      <p className="mt-8 text-sm">
        <Link href="/previsoes" className="underline">
          Projeção de tesouraria
        </Link>{" "}
        ·{" "}
        <Link href="/despesas" className="underline">
          Movimentos de despesas
        </Link>
      </p>
    </AppShell>
  );
}

export default function AnalisesPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">A carregar análises…</p>}>
      <AnalisesContent />
    </Suspense>
  );
}
