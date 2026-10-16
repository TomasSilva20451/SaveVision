import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { FinancialAlertsPanel } from "@/components/alerts/financial-alerts-panel";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { readPageFlash } from "@/lib/ui/page-shell";
import {
  countUnseenFinancialAlerts,
  evaluateAndSyncFinancialAlerts,
  listFinancialAlerts,
} from "@/server/services/financial-alerts";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

async function AlertasContent({ resolved }: { resolved: boolean }) {
  await ensureRequestDynamic();
  const flash = await readPageFlash();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const membership = await requireWorkspaceAccess(user.id, selected.id);
  if (!membership) redirect("/inicio");

  await evaluateAndSyncFinancialAlerts(user.id, selected.id);

  const [alerts, unseenCount] = await Promise.all([
    listFinancialAlerts(user.id, selected.id, {
      status: resolved ? "RESOLVED" : "ACTIVE",
      includeDismissed: resolved,
    }),
    countUnseenFinancialAlerts(user.id, selected.id),
  ]);
  if (!alerts) redirect("/inicio");

  return (
    <AppShell
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      flash={flash}
      unseenAlertsCount={unseenCount}
    >
      <h1 className="text-2xl font-semibold tracking-tight">Alertas financeiros</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Notificações persistentes e explicáveis · sem alteração de saldos · workspace «
        {selected.name}»
      </p>

      <nav className="mt-6 flex gap-4 text-sm" aria-label="Vistas de alertas">
        <Link
          href="/alertas"
          className={resolved ? "text-zinc-500" : "font-medium underline"}
          aria-current={resolved ? undefined : "page"}
        >
          Ativos
        </Link>
        <Link
          href="/alertas?resolved=1"
          className={resolved ? "font-medium underline" : "text-zinc-500"}
          aria-current={resolved ? "page" : undefined}
        >
          Resolvidos
        </Link>
      </nav>

      <div className="mt-8" data-testid="financial-alerts-page">
        <FinancialAlertsPanel alerts={alerts} showResolved={resolved} />
      </div>
    </AppShell>
  );
}

type PageProps = {
  searchParams: Promise<{ resolved?: string }>;
};

async function AlertasPageInner({ searchParams }: PageProps) {
  const params = await searchParams;
  const resolved = params.resolved === "1";
  return <AlertasContent resolved={resolved} />;
}

export default function AlertasPage(props: PageProps) {
  return (
    <Suspense fallback={<p className="p-6 text-sm">A carregar alertas…</p>}>
      <AlertasPageInner searchParams={props.searchParams} />
    </Suspense>
  );
}
