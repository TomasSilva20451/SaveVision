import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { RequestDynamicPage } from "@/components/shell/request-dynamic-page";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { requestApprovalAction, reviewApprovalAction } from "@/lib/corporate/corporate-actions";
import { readPageFlash } from "@/lib/ui/page-shell";
import { listPendingApprovals } from "@/server/services/corporate-finance";
import { countUnseenFinancialAlerts } from "@/server/services/financial-alerts";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

async function EmpresaAprovacoesPageContent() {
  await ensureRequestDynamic();
  const flash = await readPageFlash("/empresa/aprovacoes");
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const [pending, unseenCount] = await Promise.all([
    listPendingApprovals(user.id, selected.id),
    countUnseenFinancialAlerts(user.id, selected.id),
  ]);
  if (!pending) redirect("/inicio");

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
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Maker-checker</h1>
          <p className="mt-0.5 text-sm text-slate-500">O revisor tem de ser diferente do solicitante.</p>
        </div>
      }
    >
      <form action={requestApprovalAction} className="max-w-md rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold">Novo pedido</h2>
        <input type="hidden" name="actionType" value="PAYMENT_BATCH" />
        <input type="hidden" name="entityId" value="manual" />
        <label className="mt-2 block text-xs">
          Nota
          <textarea name="note" rows={2} className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm" />
        </label>
        <button type="submit" className="mt-2 rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
          Submeter
        </button>
      </form>

      <ul className="mt-6 space-y-3">
        {pending.length === 0 ? (
          <li className="text-sm text-slate-500">Sem pedidos pendentes.</li>
        ) : (
          pending.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm">
              <span>
                {item.actionType} — {item.entityType} ({item.id.slice(0, 8)})
              </span>
              <div className="flex gap-2">
                <form action={reviewApprovalAction}>
                  <input type="hidden" name="approvalId" value={item.id} />
                  <input type="hidden" name="decision" value="APPROVED" />
                  <button type="submit" className="rounded bg-emerald-700 px-2 py-1 text-xs text-white">
                    Aprovar
                  </button>
                </form>
                <form action={reviewApprovalAction}>
                  <input type="hidden" name="approvalId" value={item.id} />
                  <input type="hidden" name="decision" value="REJECTED" />
                  <button type="submit" className="rounded bg-rose-600 px-2 py-1 text-xs text-white">
                    Rejeitar
                  </button>
                </form>
              </div>
            </li>
          ))
        )}
      </ul>
    </AppShell>
  );
}

export default function EmpresaAprovacoesPage() {
  return (
    <RequestDynamicPage fallback={<p className="p-6 text-sm">A carregar aprovações…</p>}>
      <EmpresaAprovacoesPageContent />
    </RequestDynamicPage>
  );
}
