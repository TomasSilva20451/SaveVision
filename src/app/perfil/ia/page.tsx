import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { LocalAiSettingsPanel } from "@/components/help/local-ai-settings-panel";
import { Card } from "@/components/ui/card";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { readPageFlash } from "@/lib/ui/page-shell";
import { getLocalAiSettings } from "@/server/services/local-ai-settings";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";
import { countUnseenFinancialAlerts } from "@/server/services/financial-alerts";

async function IaContent() {
  await ensureRequestDynamic();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const [settings, workspaceContext, flash] = await Promise.all([
    getLocalAiSettings(user.id),
    resolveWorkspaceContext(user.id),
    readPageFlash("/perfil/ia"),
  ]);

  const unseenAlertsCount = workspaceContext.selected
    ? await countUnseenFinancialAlerts(user.id, workspaceContext.selected.id)
    : 0;

  return (
    <AppShell
      userName={user.name}
      workspaces={workspaceContext.workspaces}
      activeWorkspaceId={workspaceContext.selected?.id ?? null}
      flash={flash}
      unseenAlertsCount={unseenAlertsCount}
      headerLeading={
        <div>
          <p className="text-sm text-slate-500">
            <Link href="/perfil" className="text-blue-600 hover:underline">
              Conta e perfil
            </Link>
            {" / IA local"}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">IA local (Ollama)</h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Configura modelos, testa a ligação e controla o que é enviado ao teu Ollama.
          </p>
        </div>
      }
    >
      <Card title="Preferências">
        <LocalAiSettingsPanel initial={settings} />
      </Card>
    </AppShell>
  );
}

export default function PerfilIaPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">A carregar configuração…</p>}>
      <IaContent />
    </Suspense>
  );
}
