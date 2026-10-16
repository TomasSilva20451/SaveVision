import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { FinancialSimulationsPanel } from "@/components/simulations/financial-simulations-panel";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { readPageFlash } from "@/lib/ui/page-shell";
import { getSimulationBaseline } from "@/server/services/financial-simulations";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

async function SimulacoesContent() {
  await ensureRequestDynamic();
  const flash = await readPageFlash();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const membership = await requireWorkspaceAccess(user.id, selected.id);
  if (!membership) redirect("/inicio");

  const baseline = await getSimulationBaseline(user.id, selected.id);
  if (!baseline) redirect("/inicio");

  return (
    <AppShell
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      flash={flash}
    >
      <h1 className="text-2xl font-semibold tracking-tight">Simulações financeiras</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Experimentar decisões sem alterar contas, passivos ou transações reais · workspace «
        {selected.name}»
      </p>
      <div className="mt-8">
        <FinancialSimulationsPanel baseline={baseline} />
      </div>
    </AppShell>
  );
}

export default function SimulacoesPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">A carregar simulações…</p>}>
      <SimulacoesContent />
    </Suspense>
  );
}
