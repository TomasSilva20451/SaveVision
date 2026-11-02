import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FinancialAssistantPanel } from "@/components/assistant/financial-assistant-panel";
import { AppShell } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageSuspenseFallback } from "@/components/ui/loading";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { readPageFlash } from "@/lib/ui/page-shell";
import { countUnseenFinancialAlerts } from "@/server/services/financial-alerts";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

async function AssistenteContent() {
  await ensureRequestDynamic();
  const [flash, user] = await Promise.all([readPageFlash("/assistente"), requireAuthenticatedUser()]);
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) {
    return (
      <AppShell userName={user.name} workspaces={workspaces} activeWorkspaceId={null} flash={flash}>
        <PageHeader
          title="Assistente financeiro"
          description="Interpretação local da pergunta e cálculos no servidor. Sem SQL nem escrita na base de dados."
        />
        <div className="mt-6">
          <EmptyState
            title="Sem workspace ativo"
            description="Seleciona ou cria um espaço financeiro para usar o assistente."
            action={
              <Link href="/conta-conjunta" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white">
                Gerir espaços
              </Link>
            }
          />
        </div>
      </AppShell>
    );
  }

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
    <Suspense fallback={<PageSuspenseFallback shape="chat-panel" />}>
      <AssistenteContent />
    </Suspense>
  );
}
