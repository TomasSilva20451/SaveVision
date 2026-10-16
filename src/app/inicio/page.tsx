import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { readPageFlash } from "@/lib/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

async function InicioContent() {
  await ensureRequestDynamic();
  const flash = await readPageFlash();
  const user = await requireAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);

  return (
    <AppShell
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected?.id ?? null}
      flash={flash}
    >
      <PageHeader title={`Olá, ${user.name}`} description={
        selected
          ? `Estás no espaço «${selected.name}». Só vês os workspaces a que pertences; o de outra pessoa continua fechado.`
          : "A sessão está ativa, mas ainda não há workspace associado. Corre pnpm db:seed."
      } />
    </AppShell>
  );
}

export default function InicioPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">A confirmar a sessão…</p>}>
      <InicioContent />
    </Suspense>
  );
}
