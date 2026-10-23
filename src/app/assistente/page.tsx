import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FinancialAssistantPanel } from "@/components/assistant/financial-assistant-panel";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { readPageFlash } from "@/lib/ui/page-shell";
import { countUnseenFinancialAlerts } from "@/server/services/financial-alerts";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

async function AssistenteContent() {
  await ensureRequestDynamic();
  const flash = await readPageFlash("/assistente");
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const alerts = await countUnseenFinancialAlerts(user.id, selected.id);

  return (
    <AppShell
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      flash={flash}
      unseenAlertsCount={alerts}
    >
      <PageHeader
        title="Assistente financeiro"
        description="Interpretação local da pergunta e cálculos no servidor. Sem SQL nem escrita na base de dados."
      />
      <div className="mt-6 max-w-3xl">
        <FinancialAssistantPanel />
      </div>
    </AppShell>
  );
}

export default function AssistentePage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">A carregar o assistente…</p>}>
      <AssistenteContent />
    </Suspense>
  );
}
