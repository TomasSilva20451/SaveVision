import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { RequestDynamicPage } from "@/components/shell/request-dynamic-page";
import {
  FinanceTable,
  FinanceTableBody,
  FinanceTableCell,
  FinanceTableHead,
  FinanceTableHeaderCell,
  FinanceTableRow,
} from "@/components/ui/finance-table";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { readPageFlash } from "@/lib/ui/page-shell";
import { scanDocumentIntegrityAction } from "@/lib/finance/document-integrity-actions";
import { searchWorkspaceAuditEvents } from "@/server/services/bank-reconciliation";
import { listUnavailableDocumentsForWorkspace } from "@/server/services/document-integrity";
import { countUnseenFinancialAlerts } from "@/server/services/financial-alerts";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

type Props = { searchParams: Promise<{ action?: string }> };

async function EmpresaAuditoriaPageContent({ searchParams }: Props) {
  await ensureRequestDynamic();
  const flash = await readPageFlash("/empresa/auditoria");
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const params = await searchParams;
  const [events, unavailableDocs, unseenCount] = await Promise.all([
    searchWorkspaceAuditEvents(user.id, selected.id, { action: params.action, limit: 80 }),
    listUnavailableDocumentsForWorkspace(user.id, selected.id),
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
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Auditoria corporativa</h1>
          <p className="mt-0.5 text-sm text-slate-500">Pesquisa read-only sobre o ledger `AuditEvent` (owners).</p>
        </div>
      }
    >
      {!events ? (
        <p className="text-sm text-slate-600">Acesso reservado a gestores do workspace.</p>
      ) : (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Integridade de documentos (R7)</h2>
            <p className="mt-1 text-xs text-slate-500">
              Verifica referências órfãs entre a base de dados e o armazenamento cifrado.
            </p>
            <form action={scanDocumentIntegrityAction} className="mt-3">
              <button type="submit" className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white">
                Executar verificação
              </button>
            </form>
            {unavailableDocs && unavailableDocs.length > 0 ? (
              <ul className="mt-3 space-y-1 text-xs text-rose-800">
                {unavailableDocs.map((doc) => (
                  <li key={doc.id}>
                    {doc.originalName} — {doc.integrityReason ?? "UNAVAILABLE"}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-slate-600">Sem documentos em quarentena neste workspace.</p>
            )}
          </section>
          <form method="get" className="mt-6 flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-slate-700">
              Filtrar ação
              <input
                name="action"
                defaultValue={params.action ?? ""}
                placeholder="BANK_RECONCILIATION"
                className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">
              Pesquisar
            </button>
          </form>
          <FinanceTable className="mt-4">
            <FinanceTableHead>
              <FinanceTableRow>
                <FinanceTableHeaderCell>Quando</FinanceTableHeaderCell>
                <FinanceTableHeaderCell>Ação</FinanceTableHeaderCell>
                <FinanceTableHeaderCell>Recurso</FinanceTableHeaderCell>
                <FinanceTableHeaderCell>Resultado</FinanceTableHeaderCell>
              </FinanceTableRow>
            </FinanceTableHead>
            <FinanceTableBody>
              {events.map((ev) => (
                <FinanceTableRow key={ev.id}>
                  <FinanceTableCell>{ev.occurredAt.toISOString()}</FinanceTableCell>
                  <FinanceTableCell>{ev.action}</FinanceTableCell>
                  <FinanceTableCell>
                    {ev.resourceType}:{ev.resourceId.slice(0, 10)}…
                  </FinanceTableCell>
                  <FinanceTableCell>{ev.outcome}</FinanceTableCell>
                </FinanceTableRow>
              ))}
            </FinanceTableBody>
          </FinanceTable>
        </>
      )}
    </AppShell>
  );
}

export default function EmpresaAuditoriaPage(props: Props) {
  return (
    <RequestDynamicPage fallback={<p className="p-6 text-sm">A carregar auditoria…</p>}>
      <EmpresaAuditoriaPageContent {...props} />
    </RequestDynamicPage>
  );
}
