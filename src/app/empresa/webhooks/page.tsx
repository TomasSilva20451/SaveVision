import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { RequestDynamicPage } from "@/components/shell/request-dynamic-page";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { createWebhookAction } from "@/lib/corporate/corporate-actions";
import { readPageFlash } from "@/lib/ui/page-shell";
import { listWebhookSubscriptions } from "@/server/services/corporate-finance";
import { countUnseenFinancialAlerts } from "@/server/services/financial-alerts";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

async function EmpresaWebhooksPageContent() {
  await ensureRequestDynamic();
  const flash = await readPageFlash("/empresa/webhooks");
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const [subs, unseenCount] = await Promise.all([
    listWebhookSubscriptions(user.id, selected.id),
    countUnseenFinancialAlerts(user.id, selected.id),
  ]);

  return (
    <AppShell
      visualTheme="aurora"
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      flash={flash}
      unseenAlertsCount={unseenCount}
      headerLeading={
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">API e webhooks</h1>
          <p className="mt-0.5 text-sm text-slate-500">Subscrições HMAC para eventos de reconciliação (owners).</p>
        </div>
      }
    >
      {!subs ? (
        <p className="text-sm text-slate-600">Acesso reservado a gestores.</p>
      ) : (
        <>
          <form action={createWebhookAction} className="max-w-lg rounded-xl border border-slate-200 bg-white p-4">
            <label className="block text-xs font-medium">
              URL HTTPS
              <input name="url" type="url" required className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="mt-3 block text-xs font-medium">
              Eventos (vírgula)
              <input name="events" defaultValue="reconciliation.matched,bank_feed.imported" className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <button type="submit" className="mt-3 rounded bg-slate-900 px-4 py-2 text-sm text-white">
              Criar webhook
            </button>
          </form>
          <ul className="mt-6 space-y-2 text-sm">
            {subs.map((s) => (
              <li key={s.id} className="rounded border border-slate-100 bg-white px-3 py-2">
                {s.url} — {s.active ? "ativo" : "inativo"} ({s.events.join(", ")})
              </li>
            ))}
          </ul>
        </>
      )}
    </AppShell>
  );
}

export default function EmpresaWebhooksPage() {
  return (
    <RequestDynamicPage fallback={<p className="p-6 text-sm">A carregar webhooks…</p>}>
      <EmpresaWebhooksPageContent />
    </RequestDynamicPage>
  );
}
