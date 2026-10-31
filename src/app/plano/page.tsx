import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { FinanceMetricCard, MetricGrid } from "@/components/ui/finance-metric-card";
import { inputClassName, labelClassName, primaryButtonClassName, secondaryButtonClassName } from "@/components/ui/form-styles";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { addGoalContributionAction, createSavingsGoalAction, registerCgdProductAction, updatePlanningSettingsAction } from "@/lib/finance/planning-actions";
import { decimal, formatEUR } from "@/lib/finance/money";
import { readPageFlash } from "@/lib/ui/page-shell";
import { listAccountsWithBalances } from "@/server/services/accounts";
import { getPlanningOverview } from "@/server/services/planning";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";
import { SavingsPlanWizard } from "@/components/planning/savings-plan-wizard";
import { PlanoHeaderActions } from "@/components/planning/plano-header-actions";
import { defaultWizardFromTemplate } from "@/server/services/savings-plan";
import { CHALLENGE_300_TEMPLATE_KEY } from "@/lib/finance/savings-plan-template";

const productLabel: Record<string, string> = {
  DEPOSIT: "Depósito",
  SAVINGS: "Poupança",
  INVESTMENT: "Investimento",
  OTHER: "Outro",
};

type SearchParams = Promise<{ "novo-plano"?: string }>;

async function PlanoContent({ searchParams }: { searchParams: SearchParams }) {
  await ensureRequestDynamic();
  const flash = await readPageFlash();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");
  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");
  const membership = await requireWorkspaceAccess(user.id, selected.id);
  if (!membership) redirect("/inicio");
  const [overview, accounts] = await Promise.all([
    getPlanningOverview(user.id, selected.id),
    listAccountsWithBalances(user.id, selected.id),
  ]);
  if (!overview) redirect("/inicio");
  const params = await searchParams;
  const showSavingsWizard = params["novo-plano"] === "1";
  const emergencyProgress = decimal(overview.emergencyTarget).gt(0)
    ? Math.min(
        100,
        decimal(overview.dashboardKpis.savingsBalance)
          .div(overview.emergencyTarget)
          .times(100)
          .toDecimalPlaces(0)
          .toNumber(),
      )
    : 0;
  const activeGoals = overview.goals.length;
  const average = activeGoals
    ? Math.round(overview.goals.reduce((sum, g) => sum + (g.progressPercent ?? 0), 0) / activeGoals)
    : 0;

  return (
    <AppShell
      visualTheme="aurora"
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      flash={flash}
    >
      <PageHeader
        title="Plano"
        description="Transforma objetivos em planos mensais claros e acompanha a tua margem de segurança."
        actions={<PlanoHeaderActions />}
      />
      {showSavingsWizard ? (
        <div className="mt-4">
          <div className="mb-2 flex justify-end">
            <Link href="/plano" className={secondaryButtonClassName}>
              Fechar assistente
            </Link>
          </div>
          <SavingsPlanWizard
            defaults={defaultWizardFromTemplate(CHALLENGE_300_TEMPLATE_KEY)!}
            savingsAccounts={(accounts ?? [])
              .filter((a) => a.type === "SAVINGS")
              .map((a) => ({ id: a.id, name: a.name }))}
            sourceAccounts={(accounts ?? [])
              .filter((a) => a.type === "CURRENT" || a.type === "CASH")
              .map((a) => ({ id: a.id, name: a.name }))}
            isPersonalWorkspace={selected.type === "PERSONAL"}
          />
        </div>
      ) : null}
      <div className="mt-6">
        <MetricGrid>
          <FinanceMetricCard
            label="Saúde financeira"
            value={`${overview.health.score}/100`}
            rawValue
            hint="Pontuação explicável com dados atuais"
            tone={overview.health.score >= 70 ? "income" : "warning"}
            icon="♡"
          />
          <FinanceMetricCard
            label="Fundo de emergência"
            value={`${emergencyProgress}%`}
            rawValue
            hint={`${formatEUR(overview.dashboardKpis.savingsBalance)} de ${formatEUR(overview.emergencyTarget)}`}
            tone="accent"
            icon="▣"
          />
          <FinanceMetricCard
            label="Objetivos ativos"
            value={String(activeGoals)}
            rawValue
            hint={activeGoals ? `Progresso médio de ${average}%` : "Cria o teu primeiro objetivo"}
            tone="analytic"
            icon="◎"
          />
          <FinanceMetricCard
            label="Margem mensal"
            value={overview.dashboardKpis.economicResultMonth}
            hint="Receitas menos despesas deste mês"
            tone={decimal(overview.dashboardKpis.economicResultMonth).gte(0) ? "income" : "expense"}
            icon="↗"
          />
        </MetricGrid>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] lg:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Financial Health Score</h2>
              <p className="mt-1 text-sm text-slate-500">Cada fator mostra como a pontuação foi calculada.</p>
            </div>
            <strong className="text-3xl text-blue-600">
              {overview.health.score}
              <span className="text-base text-slate-400">/100</span>
            </strong>
          </div>
          <ProgressBar
            value={overview.health.score}
            className="mt-5"
            tone={overview.health.score >= 70 ? "income" : "warning"}
          />
          <ul className="mt-5 grid gap-3 sm:grid-cols-3">
            {overview.health.factors.map((f) => (
              <li key={f.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                <div className="flex justify-between gap-2">
                  <strong className="text-sm">{f.label}</strong>
                  <span
                    className={`text-xs font-semibold ${f.impact >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                  >
                    {f.impact >= 0 ? "+" : ""}
                    {f.impact}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{f.detail}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] lg:col-span-2">
          <h2 className="font-semibold">Fundo de emergência</h2>
          <p className="mt-1 text-sm text-slate-500">Cobertura para despesas essenciais.</p>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-2xl font-semibold">{formatEUR(overview.dashboardKpis.savingsBalance)}</p>
              <p className="text-xs text-slate-500">Objetivo: {formatEUR(overview.emergencyTarget)}</p>
            </div>
            <strong className="text-blue-600">{emergencyProgress}%</strong>
          </div>
          <ProgressBar value={emergencyProgress} className="mt-3" />
          <form action={updatePlanningSettingsAction} className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className={labelClassName}>
              Meses alvo
              <input
                name="emergencyFundTargetMonths"
                type="number"
                min={1}
                max={24}
                defaultValue={overview.settings.emergencyFundTargetMonths}
                className={inputClassName}
              />
            </label>
            <label className={labelClassName}>
              Essenciais/mês (€)
              <input
                name="monthlyEssentialExpenses"
                defaultValue={overview.settings.monthlyEssentialExpenses?.toString() ?? ""}
                placeholder={overview.monthlyEssential}
                className={inputClassName}
              />
            </label>
            <button className={`${primaryButtonClassName} sm:col-span-2`}>Guardar definições</button>
          </form>
        </section>
      </div>
      {overview.cashSweep ? (
        <aside className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center dark:border-amber-900 dark:bg-amber-950/30">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-100 text-xl">↗</span>
          <div className="flex-1">
            <h2 className="font-semibold">
              Sugestão Smart Cash Sweep: {formatEUR(overview.cashSweep.suggestedAmount)}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {overview.cashSweep.rationale} É apenas uma sugestão e não executa transferências.
            </p>
          </div>
        </aside>
      ) : null}
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] xl:col-span-2">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <h2 className="font-semibold">Objetivos financeiros</h2>
              <p className="mt-1 text-sm text-slate-500">Progresso, ritmo necessário e cenários calculados.</p>
            </div>
            <details className="group">
              <summary className={`${primaryButtonClassName} cursor-pointer list-none`}>＋ Novo objetivo</summary>
              <form
                action={createSavingsGoalAction}
                className="mt-3 grid min-w-72 gap-3 rounded-xl border border-[var(--border)] bg-slate-50 p-4 dark:bg-slate-900"
              >
                <input name="title" placeholder="Título" required className={inputClassName} />
                <input name="targetAmount" placeholder="Montante alvo" required className={inputClassName} />
                <select name="kind" className={inputClassName}>
                  <option value="GENERAL">Geral</option>
                  <option value="EMERGENCY_FUND">Fundo de emergência</option>
                </select>
                <select name="accountId" className={inputClassName}>
                  <option value="">Sem conta associada</option>
                  {(accounts ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <button className={primaryButtonClassName}>Criar objetivo</button>
              </form>
            </details>
          </div>
          {overview.goals.length ? (
            <ul className="mt-5 grid gap-4 md:grid-cols-2">
              {overview.goals.map((goal) => (
                <li key={goal.id} className="rounded-xl border border-[var(--border)] p-4">
                  <div className="flex justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{goal.title}</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatEUR(goal.contributedTotal)} de {formatEUR(goal.targetAmount.toString())}
                      </p>
                    </div>
                    <strong className="text-blue-600">{goal.progressPercent ?? 0}%</strong>
                  </div>
                  <ProgressBar value={goal.progressPercent ?? 0} className="mt-3" />
                  <p className="mt-3 text-xs text-slate-500">
                    {goal.monthlyRequired
                      ? `${formatEUR(goal.monthlyRequired)}/mês durante ${goal.monthsRemaining} meses (estimativa).`
                      : "Objetivo atingido ou sem prazo definido."}
                  </p>
                  <form action={addGoalContributionAction} className="mt-3 flex gap-2">
                    <input type="hidden" name="goalId" value={goal.id} />
                    <input
                      name="amount"
                      inputMode="decimal"
                      required
                      placeholder="Contribuição"
                      className={`${inputClassName} mt-0`}
                    />
                    <button className={secondaryButtonClassName}>Registar</button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Ainda não tens objetivos"
              description="Cria um objetivo para transformar intenção num plano mensurável."
            />
          )}
        </section>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
          <h2 className="font-semibold">Produtos registados</h2>
          <p className="mt-1 text-sm text-slate-500">Referências manuais, sem taxas inventadas.</p>
          <ul className="mt-4 divide-y divide-[var(--border)]">
            {overview.cgdProducts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-3 text-sm">
                <span>
                  <strong>{p.label}</strong>
                  {p.reference ? <small className="block text-slate-500">{p.reference}</small> : null}
                </span>
                <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
                  {productLabel[p.category] ?? p.category}
                </span>
              </li>
            ))}
          </ul>
          <details className="mt-4">
            <summary className={`${secondaryButtonClassName} cursor-pointer list-none`}>＋ Adicionar produto</summary>
            <form action={registerCgdProductAction} className="mt-3 grid gap-2">
              <input name="label" placeholder="Nome" required className={inputClassName} />
              <select name="category" className={inputClassName}>
                <option value="DEPOSIT">Depósito</option>
                <option value="SAVINGS">Poupança</option>
                <option value="INVESTMENT">Investimento</option>
                <option value="OTHER">Outro</option>
              </select>
              <input name="reference" placeholder="Referência (opcional)" className={inputClassName} />
              <button className={primaryButtonClassName}>Adicionar</button>
            </form>
          </details>
        </section>
      </div>
    </AppShell>
  );
}

export default function PlanoPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm">A carregar plano…</p>}>
      <PlanoContent searchParams={searchParams} />
    </Suspense>
  );
}
