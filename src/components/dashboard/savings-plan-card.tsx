import Link from "next/link";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatEUR } from "@/lib/finance/money";
import { primaryButtonClassName, secondaryButtonClassName } from "@/components/ui/form-styles";
import { registerSavingsPlanContributionAction } from "@/lib/finance/savings-plan-actions";
import { formatCivilDate, civilDateFromInstant } from "@/lib/datetime/civil-date";
import type { getSavingsPlanDashboardCard } from "@/server/services/savings-plan";

type CardData = NonNullable<Awaited<ReturnType<typeof getSavingsPlanDashboardCard>>>;

export function SavingsPlanDashboardCard({ data }: { data: CardData }) {
  const progress = data.progress.progressPercent ?? 0;
  const checkIn = data.currentCheckIn;

  return (
    <section
      className="col-span-full rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-[var(--shadow-card)] dark:border-emerald-900 dark:from-emerald-950/40 dark:to-[var(--surface)] lg:col-span-2"
      aria-labelledby="savings-plan-card-title"
      data-testid="savings-plan-dashboard-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="savings-plan-card-title" className="text-lg font-semibold">
            {data.name}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {formatEUR(data.progress.contributed)} de {formatEUR(data.progress.target)} ·{" "}
            {data.remainingWeeks} semanas restantes · faltam {formatEUR(data.progress.amountRemaining)}
          </p>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
          {data.status === "PAUSED" ? "Pausado" : data.status === "COMPLETED" ? "Concluído" : "Activo"}
        </span>
      </div>
      <ProgressBar value={Math.min(100, progress)} className="mt-4" tone="income" />
      <p className="mt-3 text-sm">
        Semana:{" "}
        {checkIn
          ? checkIn.status === "COMPLETED"
            ? "contribuição registada"
            : `pendente até ${formatCivilDate(civilDateFromInstant(checkIn.periodEnd))}`
          : "sem check-ins"}
        · esperado {formatEUR(data.weeklyExpected)}
      </p>
      {data.savingsAccountArchived ? (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">Conta de poupança arquivada.</p>
      ) : null}
      {data.investmentGuardEnabled && !data.progress.targetReached ? (
        <p className="mt-2 text-xs text-slate-500">
          Conclui primeiro a tua reserva de {formatEUR(data.progress.target)} antes de destacar investimentos.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {checkIn && checkIn.status === "DUE" ? (
          <form action={registerSavingsPlanContributionAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="planId" value={data.planId} />
            <input type="hidden" name="checkInId" value={checkIn.id} />
            <input type="hidden" name="contributedAtIso" value={new Date().toISOString().slice(0, 10)} />
            <label className="text-xs">
              Valor (€)
              <input
                name="amount"
                defaultValue={data.weeklyExpected}
                className="mt-1 block rounded-lg border px-2 py-1 text-sm"
                required
              />
            </label>
            <input type="hidden" name="transferConfirmed" value="on" />
            <p className="text-xs text-slate-500">
              Será criada uma transferência da conta de origem do plano para a poupança.
            </p>
            <button type="submit" className={primaryButtonClassName}>
              Registar contribuição
            </button>
          </form>
        ) : null}
        <Link href={`/planeamento/plano-poupanca/${data.planId}`} className={secondaryButtonClassName}>
          Ver plano
        </Link>
        <Link href="/orcamentos" className={secondaryButtonClassName}>
          Rever orçamento
        </Link>
      </div>
    </section>
  );
}
