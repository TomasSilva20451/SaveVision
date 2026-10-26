import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { RequestDynamicPage } from "@/components/shell/request-dynamic-page";
import { DashboardKpiCard } from "@/components/dashboard/dashboard-kpi-card";
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
import { formatCivilDate } from "@/lib/datetime/civil-date";
import { civilDateFromInstant } from "@/lib/datetime/civil-date";
import { formatEUR } from "@/lib/finance/money";
import {
  importBankFeedAction,
  manualReconcileAction,
  runAutoReconcileAction,
} from "@/lib/corporate/corporate-actions";
import { readPageFlash } from "@/lib/ui/page-shell";
import { getReconciliationPageData } from "@/server/services/bank-reconciliation";
import { countUnseenFinancialAlerts } from "@/server/services/financial-alerts";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

async function ReconciliacaoPageContent() {
  await ensureRequestDynamic();
  const flash = await readPageFlash("/reconciliacao");
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const [data, unseenCount] = await Promise.all([
    getReconciliationPageData(user.id, selected.id),
    countUnseenFinancialAlerts(user.id, selected.id),
  ]);
  if (!data) redirect("/inicio");

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
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Reconciliação bancária</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Cruza o extrato importado com o ledger interno — base confiável para relatórios e ERP.
          </p>
        </div>
      }
    >
      <div className="grid min-w-0 gap-4 sm:grid-cols-3">
        <div data-testid="recon-kpi-unmatched">
          <DashboardKpiCard label="Por reconciliar" value={String(data.kpis.unmatchedCount)} tone="expense" rawValue icon="!" />
        </div>
        <div data-testid="recon-kpi-matched">
          <DashboardKpiCard label="Emparelhados" value={String(data.kpis.matchedCount)} tone="income" rawValue icon="✓" />
        </div>
        <div data-testid="recon-kpi-duplicates">
          <DashboardKpiCard label="Duplicados no extrato" value={String(data.kpis.duplicateCount)} tone="analytic" rawValue icon="≈" />
        </div>
      </div>

      {data.canEdit ? (
        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <form action={importBankFeedAction} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Importar extrato (CSV)</h2>
            <p className="mt-1 text-xs text-slate-500">Colunas: data, montante, descrição. Read-only — sem débitos.</p>
            <label className="mt-3 block text-xs font-medium text-slate-700">
              Conta
              <select name="accountId" required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                {data.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-xs font-medium text-slate-700">
              CSV
              <textarea
                name="csvText"
                rows={5}
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                placeholder={"data,montante,descricao\n2026-10-01,-25.00,Pagamento fornecedor"}
              />
            </label>
            <button type="submit" className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
              Importar
            </button>
          </form>

          <form action={runAutoReconcileAction} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Reconciliação automática</h2>
            <p className="mt-1 text-xs text-slate-500">
              Emparelha por montante, data (±2 dias civis) e descrição similar. Confiança mínima 85%.
            </p>
            <button type="submit" className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white">
              Executar auto-match
            </button>
          </form>
        </section>
      ) : null}

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Linhas do extrato por reconciliar</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              O copiloto apenas ordena candidatos e mostra evidência. A confirmação continua a ser humana.
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-200">
            {data.copilotSuggestions.length} sugestão(ões) explicáveis
          </span>
        </div>
        <FinanceTable className="mt-3">
          <FinanceTableHead>
            <FinanceTableRow>
              <FinanceTableHeaderCell>Data</FinanceTableHeaderCell>
              <FinanceTableHeaderCell>Conta</FinanceTableHeaderCell>
              <FinanceTableHeaderCell>Montante</FinanceTableHeaderCell>
              <FinanceTableHeaderCell>Descrição</FinanceTableHeaderCell>
              {data.canEdit ? <FinanceTableHeaderCell>Emparelhar</FinanceTableHeaderCell> : null}
            </FinanceTableRow>
          </FinanceTableHead>
          <FinanceTableBody>
            {data.feedLines.length === 0 ? (
              <FinanceTableRow>
                <FinanceTableCell colSpan={data.canEdit ? 5 : 4}>Sem linhas pendentes. Importa um CSV ou liga Open Banking.</FinanceTableCell>
              </FinanceTableRow>
            ) : (
              data.feedLines.map((line) => {
                const suggestion = data.copilotSuggestions.find((item) => item.bankLineId === line.id);
                return <FinanceTableRow key={line.id}>
                  <FinanceTableCell>{formatCivilDate(civilDateFromInstant(line.bookingDate))}</FinanceTableCell>
                  <FinanceTableCell>{line.accountName}</FinanceTableCell>
                  <FinanceTableCell>{formatEUR(line.amount)}</FinanceTableCell>
                  <FinanceTableCell>{line.description ?? "—"}</FinanceTableCell>
                  {data.canEdit ? (
                    <FinanceTableCell>
                      <form action={manualReconcileAction} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="bankFeedLineId" value={line.id} />
                        <select name="transactionId" required className="max-w-[12rem] rounded border border-slate-200 text-xs">
                          <option value="">Movimento…</option>
                          {data.candidateTransactions.map((tx) => (
                            <option key={tx.id} value={tx.id}>
                              {suggestion?.transactionId === tx.id ? "★ Sugerido · " : ""}{formatEUR(tx.amount)} — {tx.description?.slice(0, 24) ?? tx.id.slice(0, 8)}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800">
                          Confirmar
                        </button>
                      </form>
                      {suggestion ? (
                        <p className="mt-1 text-[11px] text-blue-700 dark:text-blue-300">
                          {Math.round(suggestion.confidence * 100)}% · {suggestion.reasons.join(" + ")}
                        </p>
                      ) : null}
                    </FinanceTableCell>
                  ) : null}
                </FinanceTableRow>
              })
            )}
          </FinanceTableBody>
        </FinanceTable>
      </section>
    </AppShell>
  );
}

export default function ReconciliacaoPage() {
  return (
    <RequestDynamicPage fallback={<p className="p-6 text-sm">A carregar reconciliação…</p>}>
      <ReconciliacaoPageContent />
    </RequestDynamicPage>
  );
}
