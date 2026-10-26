import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { RequestDynamicPage } from "@/components/shell/request-dynamic-page";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { registerConsentAction, syncOpenBankingAction } from "@/lib/corporate/corporate-actions";
import { listConfiguredOpenBankingProviders } from "@/server/providers/open-banking/registry";
import { readPageFlash } from "@/lib/ui/page-shell";
import { listOpenBankingConsents, getReconciliationPageData } from "@/server/services/bank-reconciliation";
import { countUnseenFinancialAlerts } from "@/server/services/financial-alerts";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

async function OpenBankingPageContent() {
  await ensureRequestDynamic();
  const flash = await readPageFlash("/open-banking");
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const [consents, accountsData, unseenCount] = await Promise.all([
    listOpenBankingConsents(user.id, selected.id),
    getReconciliationPageData(user.id, selected.id),
    countUnseenFinancialAlerts(user.id, selected.id),
  ]);
  if (!consents || !accountsData) redirect("/inicio");

  const providers = listConfiguredOpenBankingProviders();

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
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Open Banking (read-only)</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Providers: {providers.join(", ")}. HTTP real com `FINTWIN_OPEN_BANKING_BASE_URL`.
          </p>
        </div>
      }
    >
      {accountsData.canEdit ? (
        <form action={registerConsentAction} className="max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Registar consentimento</h2>
          <label className="mt-3 block text-xs font-medium text-slate-700">
            Conta
            <select name="accountId" required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {accountsData.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-xs font-medium text-slate-700">
            Fornecedor
            <input name="provider" defaultValue="sandbox-open-banking" list="ob-providers" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <datalist id="ob-providers">
              {providers.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </label>
          <label className="mt-3 block text-xs font-medium text-slate-700">
            Referência de consentimento
            <input name="consentRef" required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <button type="submit" className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Guardar
          </button>
        </form>
      ) : null}

      <ul className="mt-8 space-y-2 text-sm">
        {consents.length === 0 ? (
          <li className="text-slate-500">Ainda não há consentimentos. Importa CSV em{" "}
            <Link href="/reconciliacao" className="text-emerald-700 underline">
              Reconciliação
            </Link>
            .
          </li>
        ) : (
          consents.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
              <span>
                <span className="font-medium">{c.account.name}</span> — {c.provider} ({c.status}) read-only
              </span>
              {accountsData.canEdit && c.status === "ACTIVE" ? (
                <form action={syncOpenBankingAction}>
                  <input type="hidden" name="consentId" value={c.id} />
                  <button type="submit" className="rounded bg-emerald-700 px-2 py-1 text-xs font-medium text-white">
                    Sincronizar extrato
                  </button>
                </form>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </AppShell>
  );
}

export default function OpenBankingPage() {
  return (
    <RequestDynamicPage fallback={<p className="p-6 text-sm">A carregar Open Banking…</p>}>
      <OpenBankingPageContent />
    </RequestDynamicPage>
  );
}
