import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { primaryButtonClassName, secondaryButtonClassName } from "@/components/ui/form-styles";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { formatCivilDate, formatCivilDateIso, civilDateFromInstant } from "@/lib/datetime/civil-date";
import { computePlanProgress } from "@/lib/finance/savings-plan-engine";
import {
  registerSavingsPlanContributionAction,
  setSavingsPlanStatusAction,
} from "@/lib/finance/savings-plan-actions";
import { formatEUR } from "@/lib/finance/money";
import { readPageFlash } from "@/lib/ui/page-shell";
import { SavingsPlanWeeklyReview } from "@/components/planning/savings-plan-weekly-review";
import { getSavingsPlanDetail, getWeeklyReviewForPlan } from "@/server/services/savings-plan";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

async function PlanDetailContent({ planId }: { planId: string }) {
  await ensureRequestDynamic();
  const flash = await readPageFlash();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");
  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");
  const membership = await requireWorkspaceAccess(user.id, selected.id);
  if (!membership) redirect("/inicio");

  const [plan, weeklyReview] = await Promise.all([
    getSavingsPlanDetail(user.id, selected.id, planId),
    getWeeklyReviewForPlan(user.id, selected.id, planId),
  ]);
  if (!plan) redirect("/planeamento");

  const targetIso = plan.goal.targetDate
    ? formatCivilDate(civilDateFromInstant(plan.goal.targetDate))
    : null;
  const progress = computePlanProgress({
    targetAmount: plan.goal.targetAmount.toString(),
    contributionAmounts: plan.goal.contributions.map((c) => c.amount.toString()),
    targetDateIso: plan.goal.targetDate
      ? formatCivilDateIso(civilDateFromInstant(plan.goal.targetDate))
      : null,
    asOf: new Date(),
  });

  const dueCheckIn = plan.checkIns.find((c) => c.status === "DUE");

  return (
    <AppShell
      visualTheme="aurora"
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      flash={flash}
    >
      <PageHeader
        title={plan.name}
        description={`Plano de poupança · conta ${plan.savingsAccount.name}`}
        actions={
          <Link href="/planeamento" className={secondaryButtonClassName}>
            Voltar ao planeamento
          </Link>
        }
      />
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 lg:col-span-2">
          <h2 className="font-semibold">Objectivo</h2>
          <p className="mt-2 text-2xl font-semibold">
            {formatEUR(progress.contributed)} / {formatEUR(progress.target)}
          </p>
          {targetIso ? <p className="text-sm text-slate-500">Data-alvo: {targetIso}</p> : null}
          <ProgressBar value={Math.min(100, progress.progressPercent ?? 0)} className="mt-4" />
          {!progress.targetReached && plan.investmentGuardEnabled ? (
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
              Conclui primeiro a tua reserva antes de explorar{" "}
              <Link href="/investimentos" className="underline">
                investimentos
              </Link>{" "}
              (sem aconselhamento garantido).
            </p>
          ) : progress.targetReached ? (
            <p className="mt-4 text-sm">
              Objectivo atingido — podes explorar{" "}
              <Link href="/investimentos" className="underline">
                investimentos
              </Link>{" "}
              com confirmação consciente do risco.
            </p>
          ) : null}
        </section>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-semibold">Estado</h2>
          <p className="mt-2 capitalize">{plan.status.toLowerCase()}</p>
          <div className="mt-4 flex flex-col gap-2">
            {plan.status === "ACTIVE" ? (
              <form action={setSavingsPlanStatusAction}>
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="status" value="PAUSED" />
                <button className={secondaryButtonClassName}>Pausar</button>
              </form>
            ) : null}
            {plan.status === "PAUSED" ? (
              <form action={setSavingsPlanStatusAction}>
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="status" value="ACTIVE" />
                <button className={secondaryButtonClassName}>Retomar</button>
              </form>
            ) : null}
            {plan.status !== "CANCELLED" ? (
              <form action={setSavingsPlanStatusAction}>
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="status" value="CANCELLED" />
                <button className={secondaryButtonClassName}>Cancelar plano</button>
              </form>
            ) : null}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Cancelar não elimina objetivo, conta, contribuições nem orçamentos.
          </p>
          <Link href="/conta-conjunta" className="mt-3 inline-block text-xs underline">
            Conta conjunta (apenas despesas partilhadas)
          </Link>
        </section>
      </div>

      {weeklyReview ? <SavingsPlanWeeklyReview review={weeklyReview} /> : null}

      {dueCheckIn ? (
        <section className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-semibold">Registar contribuição desta semana</h2>
          <form action={registerSavingsPlanContributionAction} className="mt-3 flex flex-wrap gap-3">
            <input type="hidden" name="planId" value={plan.id} />
            <input type="hidden" name="checkInId" value={dueCheckIn.id} />
            <input type="hidden" name="contributedAtIso" value={new Date().toISOString().slice(0, 10)} />
            <label className="text-sm">
              Valor (€)
              <input name="amount" defaultValue={plan.plannedContributionAmount.toString()} className="mt-1 block rounded-lg border px-2 py-1" required />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="transferConfirmed" required />
              Confirmo transferência real
            </label>
            <button className={primaryButtonClassName}>Registar</button>
          </form>
        </section>
      ) : null}

      <section className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="font-semibold">Check-ins semanais</h2>
        <ul className="mt-3 divide-y text-sm">
          {plan.checkIns.map((c) => (
            <li key={c.id} className="flex justify-between py-2">
              <span>
                {formatCivilDate(civilDateFromInstant(c.periodStart))} –{" "}
                {formatCivilDate(civilDateFromInstant(c.periodEnd))}
              </span>
              <span>{c.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}

export default function SavingsPlanDetailPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm">A carregar plano…</p>}>
      <PlanDetailWrapper params={props.params} />
    </Suspense>
  );
}

async function PlanDetailWrapper({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlanDetailContent planId={id} />;
}
