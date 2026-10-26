import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { RequestDynamicPage } from "@/components/shell/request-dynamic-page";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { openSupportCaseAction } from "@/lib/corporate/corporate-actions";
import { readPageFlash } from "@/lib/ui/page-shell";
import { listSupportCases } from "@/server/services/corporate-finance";
import { countUnseenFinancialAlerts } from "@/server/services/financial-alerts";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

async function EmpresaCasosPageContent() {
  await ensureRequestDynamic();
  const flash = await readPageFlash("/empresa/casos");
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const [cases, unseenCount] = await Promise.all([
    listSupportCases(user.id, selected.id),
    countUnseenFinancialAlerts(user.id, selected.id),
  ]);
  if (!cases) redirect("/inicio");

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
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Casos e disputas</h1>
          <p className="mt-0.5 text-sm text-slate-500">Registo interno de suporte e contestações.</p>
        </div>
      }
    >
      <form action={openSupportCaseAction} className="max-w-md rounded-xl border border-slate-200 bg-white p-4">
        <label className="block text-xs font-medium">
          Assunto
          <input name="subject" required className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm" />
        </label>
        <label className="mt-2 block text-xs font-medium">
          Ref. disputa (opcional)
          <input name="disputeRef" className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="mt-3 rounded bg-slate-900 px-4 py-2 text-sm text-white">
          Abrir caso
        </button>
      </form>
      <ul className="mt-6 space-y-2 text-sm">
        {cases.map((c) => (
          <li key={c.id} className="rounded border border-slate-100 bg-white px-3 py-2">
            <span className="font-medium">{c.subject}</span> — {c.status}
            {c.disputeRef ? ` (${c.disputeRef})` : ""}
          </li>
        ))}
      </ul>
    </AppShell>
  );
}

export default function EmpresaCasosPage() {
  return (
    <RequestDynamicPage fallback={<p className="p-6 text-sm">A carregar casos…</p>}>
      <EmpresaCasosPageContent />
    </RequestDynamicPage>
  );
}
