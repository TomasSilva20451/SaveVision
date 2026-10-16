import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ScenarioSimulator } from "@/components/planning/scenario-simulator";
import { inputClassName } from "@/components/ui/form-styles";
import { PageHeader } from "@/components/ui/page-header";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { readPageFlash } from "@/lib/ui/page-shell";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import {
  addGoalContributionAction,
  createSavingsGoalAction,
  registerCgdProductAction,
  updatePlanningSettingsAction,
} from "@/lib/finance/planning-actions";
import { formatEUR } from "@/lib/finance/money";
import { listAccountsWithBalances } from "@/server/services/accounts";
import { getPlanningOverview } from "@/server/services/planning";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

async function PlaneamentoContent() {
  await ensureRequestDynamic();
  const flash = await readPageFlash();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const membership = await requireWorkspaceAccess(user.id, selected.id);
  if (!membership) redirect("/inicio");

  const overview = await getPlanningOverview(user.id, selected.id);
  if (!overview) redirect("/inicio");

  const accounts =
    (await listAccountsWithBalances(user.id, selected.id)) ?? [];

  return (
    <AppShell
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      flash={flash}
    >
      <PageHeader
        title="Planeamento"
        description="Objetivos, fundo de emergência e registo de produtos (sem operações bancárias)."
      />

      <section className="mt-8 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-lg font-medium">Financial Health Score</h2>
        <p className="mt-2 text-3xl font-semibold">{overview.health.score}/100</p>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {overview.health.factors.map((factor) => (
            <li key={factor.id}>
              <span className="font-medium">{factor.label}</span> ({factor.impact >= 0 ? "+" : ""}
              {factor.impact}): {factor.detail}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-lg font-medium">Fundo de emergência</h2>
          <p className="mt-2 text-sm">
            Objetivo: {formatEUR(overview.emergencyTarget)} ({overview.settings.emergencyFundTargetMonths}{" "}
            meses × {formatEUR(overview.monthlyEssential)})
          </p>
          <p className="text-sm">
            Poupança atual: {formatEUR(overview.dashboardKpis.savingsBalance)}
          </p>
          <form action={updatePlanningSettingsAction} className="mt-4 grid max-w-sm gap-2">
            <label className="text-sm">
              Meses alvo
              <input
                name="emergencyFundTargetMonths"
                type="number"
                min={1}
                max={24}
                defaultValue={overview.settings.emergencyFundTargetMonths}
                className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
            <label className="text-sm">
              Despesas essenciais mensais (€)
              <input
                name="monthlyEssentialExpenses"
                defaultValue={overview.settings.monthlyEssentialExpenses?.toString() ?? ""}
                placeholder={overview.monthlyEssential}
                className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
            <button type="submit" className="w-fit rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
              Guardar definições
            </button>
          </form>
        </div>

        {overview.cashSweep ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
            <h2 className="text-lg font-medium">Smart Cash Sweep (sugestão)</h2>
            <p className="mt-2 text-sm">
              Montante sugerido: {formatEUR(overview.cashSweep.suggestedAmount)}
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {overview.cashSweep.rationale}
            </p>
          </div>
        ) : null}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Objetivos financeiros</h2>
        <form action={createSavingsGoalAction} className="mt-4 grid max-w-md gap-2">
          <input name="title" placeholder="Título" required className={inputClassName} />
          <input name="targetAmount" placeholder="Montante alvo" required className={inputClassName} />
          <select name="kind" className={inputClassName}>
            <option value="GENERAL">Geral</option>
            <option value="EMERGENCY_FUND">Fundo de emergência</option>
          </select>
          <select name="accountId" className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950">
            <option value="">Sem conta associada</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button type="submit" className="w-fit rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
            Criar objetivo
          </button>
        </form>

        <ul className="mt-6 flex flex-col gap-3">
          {overview.goals.map((goal) => (
            <li key={goal.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="font-medium">{goal.title}</p>
              <p className="text-sm">
                {formatEUR(goal.contributedTotal)} / {formatEUR(goal.targetAmount.toString())}
                {goal.progressPercent != null ? ` (${goal.progressPercent} %)` : null}
              </p>
              {goal.monthlyRequired ? (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Contribuição mensal necessária (≈): {formatEUR(goal.monthlyRequired)} ·{" "}
                  {goal.monthsRemaining} meses restantes (projeção, não garantia)
                </p>
              ) : null}
              {goal.scenarios?.length ? (
                <ul className="mt-2 flex flex-col gap-1 text-xs text-zinc-500">
                  {goal.scenarios.map((scenario) => (
                    <li key={scenario.id}>
                      {scenario.id}: {formatEUR(scenario.monthlyContribution)}/mês
                      {scenario.estimatedMonths != null
                        ? ` · ~${scenario.estimatedMonths} meses`
                        : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              <form action={addGoalContributionAction} className="mt-2 flex flex-wrap gap-2">
                <input type="hidden" name="goalId" value={goal.id} />
                <input name="amount" placeholder="Contribuição" className="rounded-lg border px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
                <button type="submit" className="rounded-lg border px-2 py-1 text-sm dark:border-zinc-700">
                  Registar
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Produtos CGD (registo manual)</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Apenas etiquetas definidas por ti. O FinTwin não inventa taxas nem condições.
        </p>
        <form action={registerCgdProductAction} className="mt-4 grid max-w-md gap-2">
          <input name="label" placeholder="Nome do produto" required className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
          <select name="category" className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950">
            <option value="DEPOSIT">Depósito</option>
            <option value="SAVINGS">Poupança</option>
            <option value="INVESTMENT">Investimento</option>
            <option value="OTHER">Outro</option>
          </select>
          <input name="reference" placeholder="Referência (opcional)" className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
          <button type="submit" className="w-fit rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
            Adicionar produto
          </button>
        </form>
        <ul className="mt-4 text-sm">
          {overview.cgdProducts.map((p) => (
            <li key={p.id}>
              {p.label} · {p.category}
            </li>
          ))}
        </ul>
      </section>

      <ScenarioSimulator startingBalance={overview.dashboardKpis.totalBalance} />
    </AppShell>
  );
}

export default function PlaneamentoPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">A carregar planeamento…</p>}>
      <PlaneamentoContent />
    </Suspense>
  );
}
