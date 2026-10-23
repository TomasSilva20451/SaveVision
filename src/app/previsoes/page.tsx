import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TreasuryForecastPanel } from "@/components/forecast/treasury-forecast-panel";
import { AppShell } from "@/components/shell/app-shell";
import { filterApplyButtonClassName } from "@/components/ui/form-styles";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { TREASURY_HORIZON_DAYS } from "@/lib/finance/treasury-forecast";
import { readPageFlash } from "@/lib/ui/page-shell";
import { countUnseenFinancialAlerts } from "@/server/services/financial-alerts";
import { getTreasuryForecastDashboard } from "@/server/services/treasury-forecast";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

type PageProps = { searchParams: Promise<{ horizon?: string }> };

async function PrevisoesContent({ searchParams }: PageProps) {
  await ensureRequestDynamic();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");
  const membership = await requireWorkspaceAccess(user.id, selected.id);
  if (!membership) redirect("/inicio");

  const params = await searchParams;
  const requestedHorizon = Number(params.horizon ?? "30");
  const [dashboard, flash, unseenAlertsCount] = await Promise.all([
    getTreasuryForecastDashboard(user.id, selected.id, requestedHorizon),
    readPageFlash("/previsoes"),
    countUnseenFinancialAlerts(user.id, selected.id),
  ]);
  if (!dashboard) redirect("/inicio");

  return (
    <AppShell
      visualTheme="aurora"
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      flash={flash}
      unseenAlertsCount={unseenAlertsCount}
      headerLeading={
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Previsões</h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Projeta o teu futuro financeiro com base nos teus dados atuais e objetivos.
          </p>
        </div>
      }
      headerActions={
        <>
          <form method="get" className="flex items-center">
            <label htmlFor="forecast-horizon" className="sr-only">
              Horizonte da previsão
            </label>
            <select
              id="forecast-horizon"
              name="horizon"
              defaultValue={String(dashboard.horizonDays)}
              className="h-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
            >
              {TREASURY_HORIZON_DAYS.map((days) => (
                <option key={days} value={days}>
                  {days === 365 ? "Próximos 12 meses (365 dias)" : `Próximos ${days} dias`}
                </option>
              ))}
            </select>
            <button className={filterApplyButtonClassName}>
              Aplicar
            </button>
          </form>
          <Link
            href="/simulacoes"
            className="inline-flex h-10 items-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            + Nova simulação
          </Link>
        </>
      }
    >
      <div className="mt-4">
        <TreasuryForecastPanel data={dashboard} />
      </div>
    </AppShell>
  );
}

export default function PrevisoesPage(props: PageProps) {
  return (
    <Suspense fallback={<p className="p-6 text-sm">A carregar previsões…</p>}>
      <PrevisoesContent searchParams={props.searchParams} />
    </Suspense>
  );
}
