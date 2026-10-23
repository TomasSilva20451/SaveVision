import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { FinancialSimulationsPanel } from "@/components/simulations/financial-simulations-panel";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { readPageFlash } from "@/lib/ui/page-shell";
import { countUnseenFinancialAlerts } from "@/server/services/financial-alerts";
import { getSimulationBaseline } from "@/server/services/financial-simulations";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

async function SimulacoesContent() {
  await ensureRequestDynamic();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const membership = await requireWorkspaceAccess(user.id, selected.id);
  if (!membership) redirect("/inicio");

  const [baseline, flash, unseenAlertsCount] = await Promise.all([
    getSimulationBaseline(user.id, selected.id),
    readPageFlash("/simulacoes"),
    countUnseenFinancialAlerts(user.id, selected.id),
  ]);
  if (!baseline) redirect("/inicio");

  return (
    <AppShell
      visualTheme="aurora"
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      flash={flash}
      unseenAlertsCount={unseenAlertsCount}
      headerLeading={
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Simulações</h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Explora diferentes cenários e toma decisões mais informadas para o teu futuro financeiro.
          </p>
        </div>
      }
    >
      <div className="mt-2">
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
