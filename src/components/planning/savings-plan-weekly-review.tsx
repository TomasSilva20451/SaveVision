import { formatEUR } from "@/lib/finance/money";
import type { WeeklyReviewSnapshot } from "@/server/services/savings-plan";

export function SavingsPlanWeeklyReview({ review }: { review: WeeklyReviewSnapshot }) {
  return (
    <section
      className="mt-5 rounded-2xl border border-blue-200 bg-blue-50/80 p-5 dark:border-blue-900 dark:bg-blue-950/30"
      aria-labelledby="weekly-review-title"
      data-testid="savings-plan-weekly-review"
    >
      <h2 id="weekly-review-title" className="font-semibold">
        Revisão semanal
      </h2>
      {review.isReviewDay ? (
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Domingo — revê o teu plano antes de avançar. Nada é registado automaticamente.
        </p>
      ) : (
        <p className="mt-1 text-sm text-slate-500">Resumo da semana corrente.</p>
      )}
      <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <li>
          Contribuição desta semana:{" "}
          <strong>{review.contributionRegisteredThisWeek ? "Sim" : "Ainda não"}</strong>
        </li>
        <li>
          Poupado (total): <strong>{formatEUR(review.contributedTotal)}</strong>
        </li>
        <li>
          Em falta: <strong>{formatEUR(review.amountRemaining)}</strong>
        </li>
        <li>
          Semanas restantes: <strong>{review.weeksRemaining}</strong>
        </li>
        <li>
          Ritmo sugerido: <strong>{formatEUR(review.weeklyContributionNeeded)}/semana</strong>
        </li>
        <li>
          Progresso: <strong>{review.progressPercent ?? 0}%</strong>
        </li>
      </ul>
      {review.categoriesAboveThreshold.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm font-medium">Orçamentos acima do limite do plano</p>
          <ul className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            {review.categoriesAboveThreshold.map((c) => (
              <li key={c.name}>
                {c.name}: {c.utilizationPercent}%
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {review.protectedAccountWithdrawals.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm font-medium text-rose-700 dark:text-rose-300">Saídas da conta protegida</p>
          <ul className="mt-1 text-sm">
            {review.protectedAccountWithdrawals.map((w, i) => (
              <li key={i}>
                {w.occurredAtIso}: {formatEUR(w.amount)} — {w.description ?? "—"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="mt-4 text-xs text-slate-500">{review.deterministicProjectionNote}</p>
    </section>
  );
}
