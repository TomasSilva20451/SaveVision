import Link from "next/link";
import type { FinancialInsight } from "@/lib/finance/financial-insights";
import { formatEUR } from "@/lib/finance/money";

const severityClass: Record<FinancialInsight["severity"], string> = {
  INFORMATION: "border-zinc-200 dark:border-zinc-800",
  POSITIVE: "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20",
  ATTENTION: "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20",
  WARNING: "border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/20",
};

type Summary = {
  expenseMonth: string;
  expenseChangePercent: number | null;
  incomeMonth: string;
  incomeChangePercent: number | null;
  economicResultMonth: string;
  subscriptionMonthlyTotal: string;
  subscriptionAnnualEquivalent: string;
  upcomingWeekOutflows: string;
  topConcentrationPercent: number | null;
};

type FinancialInsightsPanelProps = {
  summary: Summary;
  insights: FinancialInsight[];
  compact?: boolean;
};

export function FinancialInsightsPanel({
  summary,
  insights,
  compact = false,
}: FinancialInsightsPanelProps) {
  const shown = compact ? insights.slice(0, 4) : insights;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Despesas (mês)</p>
          <p className="text-xl font-semibold" data-testid="insights-expense-month">
            {formatEUR(summary.expenseMonth)}
          </p>
          {summary.expenseChangePercent != null ? (
            <p className="text-xs text-zinc-500">
              {summary.expenseChangePercent >= 0 ? "+" : ""}
              {summary.expenseChangePercent.toFixed(1)}% vs mês anterior
            </p>
          ) : null}
        </div>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Subscrições (eq. mensal)</p>
          <p className="text-xl font-semibold">{formatEUR(summary.subscriptionMonthlyTotal)}</p>
          <p className="text-xs text-zinc-500">
            ~{formatEUR(summary.subscriptionAnnualEquivalent)}/ano (previsto)
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Previsto 7 dias (saídas)</p>
          <p className="text-xl font-semibold">{formatEUR(summary.upcomingWeekOutflows)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Resultado económico (mês)</p>
          <p className="text-xl font-semibold">{formatEUR(summary.economicResultMonth)}</p>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-medium">
          {compact ? "Insights financeiros" : "Análises e recomendações"}
        </h2>
        <ul className="mt-4 flex flex-col gap-3">
          {shown.map((insight) => (
            <li
              key={insight.id}
              className={`rounded-xl border p-4 ${severityClass[insight.severity]}`}
              data-testid="financial-insight-item"
            >
              <p className="font-medium">{insight.title}</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{insight.description}</p>
              {insight.evidence.length > 0 ? (
                <ul className="mt-2 list-disc pl-5 text-xs text-zinc-500">
                  {insight.evidence.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
              {insight.suggestedAction ? (
                <p className="mt-2 text-sm">{insight.suggestedAction}</p>
              ) : null}
              {insight.linkHref ? (
                <Link href={insight.linkHref} className="mt-2 inline-block text-sm underline">
                  Ver detalhe
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
