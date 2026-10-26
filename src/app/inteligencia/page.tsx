import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { RequestDynamicPage } from "@/components/shell/request-dynamic-page";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { formatEUR } from "@/lib/finance/money";
import { getAdvancedFinancialIntelligence } from "@/server/services/advanced-financial-intelligence";
import { countUnseenFinancialAlerts } from "@/server/services/financial-alerts";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

const riskStyle = {
  LOW: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
  MEDIUM: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
  HIGH: "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100",
} as const;

async function InteligenciaPageContent() {
  await ensureRequestDynamic();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");
  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const [data, unseenAlertsCount] = await Promise.all([
    getAdvancedFinancialIntelligence(user.id, selected.id),
    countUnseenFinancialAlerts(user.id, selected.id),
  ]);
  if (!data) redirect("/inicio");

  return (
    <AppShell
      visualTheme="aurora"
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      unseenAlertsCount={unseenAlertsCount}
      headerLeading={
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inteligência financeira</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Cenários estatísticos e recomendações explicáveis, sempre em modo de leitura.
          </p>
        </div>
      }
      headerActions={
        <Link href="/previsoes" className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-blue-400 hover:text-blue-600">
          Previsões determinísticas
        </Link>
      }
    >
      <section className="grid gap-4 md:grid-cols-3" aria-label="Cenários probabilísticos">
        {(["p10", "p50", "p90"] as const).map((key) => (
          <article key={key} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{key.toUpperCase()} · 6 meses</p>
            <p className="mt-2 text-2xl font-bold">{formatEUR(data.forecast[key])}</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {key === "p10" ? "Cenário conservador" : key === "p50" ? "Mediana estimada" : "Cenário favorável"}
            </p>
          </article>
        ))}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className={`rounded-2xl border p-5 ${riskStyle[data.liquidityRisk.level]}`}>
          <p className="text-xs font-bold uppercase tracking-wider">Risco de falta de liquidez</p>
          <h2 className="mt-2 text-2xl font-bold">
            {data.liquidityRisk.level === "LOW" ? "Baixo" : data.liquidityRisk.level === "MEDIUM" ? "Moderado" : "Elevado"}
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            {data.liquidityRisk.reasons.map((reason) => <li key={reason}>• {reason}</li>)}
          </ul>
          <p className="mt-4 text-sm">Saídas conhecidas a 30 dias: <strong>{formatEUR(data.next30DaysKnownOutflows)}</strong></p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300">Recomendação explicável</p>
          <h2 className="mt-2 text-xl font-bold">Poupança mensal sugerida: {formatEUR(data.savingsRecommendation.suggestedMonthlyAmount)}</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            {data.savingsRecommendation.reasons.map((reason) => <li key={reason}>• {reason}</li>)}
          </ul>
          <p className="mt-5 rounded-xl bg-blue-50 p-3 text-sm font-medium text-blue-900 dark:bg-blue-950/50 dark:text-blue-100">
            Isto é uma sugestão. Não cria transferências, objetivos ou movimentos; qualquer ação exige confirmação humana.
          </p>
        </article>
      </div>

      <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-lg font-bold">Transparência do cálculo</h2>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <p><span className="block text-slate-500 dark:text-slate-400">Método</span>{data.forecast.method}</p>
          <p><span className="block text-slate-500 dark:text-slate-400">Histórico</span>{data.forecast.sampleMonths} meses</p>
          <p><span className="block text-slate-500 dark:text-slate-400">Confiança</span>{data.forecast.confidence}</p>
          <p><span className="block text-slate-500 dark:text-slate-400">Volatilidade mensal</span>{formatEUR(data.forecast.monthlyVolatility)}</p>
        </div>
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          P10/P50/P90 são cenários baseados no histórico observado, não garantias. O FinTwin não executa aconselhamento regulado, crédito ou investimento.
        </p>
      </section>
    </AppShell>
  );
}

export default function InteligenciaPage() {
  return (
    <RequestDynamicPage fallback={<p className="p-6 text-sm">A carregar inteligência…</p>}>
      <InteligenciaPageContent />
    </RequestDynamicPage>
  );
}
