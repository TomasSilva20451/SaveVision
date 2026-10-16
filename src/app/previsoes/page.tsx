import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { TreasuryForecastPanel } from "@/components/forecast/treasury-forecast-panel";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { readPageFlash } from "@/lib/ui/page-shell";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { formatCivilDateIso, civilDateFromInstant } from "@/lib/datetime/civil-date";
import { TREASURY_HORIZON_DAYS } from "@/lib/finance/treasury-forecast";
import { getForecastInsights } from "@/server/services/forecast";
import { getTreasuryForecast, getTreasuryForecastAllHorizons } from "@/server/services/treasury-forecast";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

type PageProps = {
  searchParams: Promise<{ horizon?: string }>;
};

async function PrevisoesContent({ searchParams }: PageProps) {
  await ensureRequestDynamic();
  const flash = await readPageFlash();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const membership = await requireWorkspaceAccess(user.id, selected.id);
  if (!membership) redirect("/inicio");

  const params = await searchParams;
  const horizon = Number(params.horizon ?? "30");

  const [insights, treasury, horizonSummary] = await Promise.all([
    getForecastInsights(user.id, selected.id),
    getTreasuryForecast(user.id, selected.id, horizon),
    getTreasuryForecastAllHorizons(user.id, selected.id),
  ]);

  if (!insights || !treasury) redirect("/inicio");

  const eventsForUi = treasury.projection.eventSteps.map((step) => ({
    label: step.label,
    civilDate: formatCivilDateIso(civilDateFromInstant(step.dueDate)),
    amount: step.amount,
    direction: step.direction,
    source: step.source,
    movementKind: step.movementKind,
    balanceAfter: step.balanceAfter,
  }));

  return (
    <AppShell
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      flash={flash}
    >
      <h1 className="text-2xl font-semibold tracking-tight">{treasury.labels.projectionTitle}</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Horizonte {treasury.horizonDays} dias · saldo real (contas) vs saldo projetado (previstos).
        {treasury.labels.economicNote} Provider: {insights.provider}. Sem machine learning.
      </p>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Horizonte (dias)
          <select
            name="horizon"
            defaultValue={String(treasury.horizonDays)}
            className="ml-2 rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          >
            {TREASURY_HORIZON_DAYS.map((days) => (
              <option key={days} value={days}>
                {days}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Atualizar
        </button>
      </form>

      <div className="mt-6 flex flex-wrap gap-2 text-xs">
        {horizonSummary?.map((row) => (
          <Link
            key={row.horizonDays}
            href={`/previsoes?horizon=${row.horizonDays}`}
            className={`rounded-full border px-3 py-1 ${
              row.horizonDays === treasury.horizonDays
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {row.horizonDays}d · {row.projectedBalance} €
          </Link>
        ))}
      </div>

      {treasury.configurationWarnings.length > 0 ? (
        <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/30">
          <h2 className="font-medium">Configuração e limitações</h2>
          <ul className="mt-2 list-disc pl-5">
            {treasury.configurationWarnings.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-8">
        <TreasuryForecastPanel
          horizonDays={treasury.horizonDays}
          realBalance={treasury.realBalance}
          projectedBalance={treasury.projection.projectedBalance}
          expectedInflows={treasury.projection.expectedInflows}
          expectedOutflows={treasury.projection.expectedOutflows}
          limitationNotice={treasury.labels.limitationNotice}
          sourcesIncluded={treasury.sourcesIncluded}
          sourcesExcluded={treasury.sourcesExcluded}
          timeline={treasury.projection.timeline}
          events={eventsForUi}
        />
      </div>

      <section className="mt-10 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-lg font-medium">Legenda financeira</h2>
        <ul className="mt-2 list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
          <li>Resultado económico: receitas/despesas realizadas (não inclui previstos).</li>
          <li>Movimento de caixa: entradas/saídas efetivas (inclui amortização de capital).</li>
          <li>Saldo projetado: saldo real ± obrigações previstas no horizonte (não altera contas).</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Alertas (regras)</h2>
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {insights.alerts.length === 0 ? (
            <li>Sem alertas no momento.</li>
          ) : (
            insights.alerts.map((alert) => (
              <li
                key={alert.code}
                className={alert.severity === "warning" ? "text-amber-700 dark:text-amber-400" : ""}
              >
                {alert.message}
              </li>
            ))
          )}
        </ul>
      </section>
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
