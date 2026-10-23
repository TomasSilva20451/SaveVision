import Link from "next/link";
import type { ReactNode } from "react";
import { formatEUR } from "@/lib/finance/money";

export type MetricTone = "neutral" | "income" | "expense" | "warning" | "analytic" | "accent";

const toneIcon: Record<MetricTone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  income: "bg-emerald-100 text-emerald-700",
  expense: "bg-rose-100 text-rose-700",
  warning: "bg-amber-100 text-amber-800",
  analytic: "bg-violet-100 text-violet-700",
  accent: "bg-blue-100 text-blue-700",
};

type FinanceMetricCardProps = {
  label: string;
  value: string;
  hint?: string;
  tone?: MetricTone;
  icon?: ReactNode;
  href?: string;
  rawValue?: boolean;
  /** Expõe o rótulo como cabeçalho de secção (acessibilidade / testes). */
  labelHeadingLevel?: 2 | 3;
};

export function FinanceMetricCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  href,
  rawValue = false,
  labelHeadingLevel,
}: FinanceMetricCardProps) {
  const display = rawValue || value.includes("€") ? value : formatEUR(value);

  const labelNode =
    labelHeadingLevel === 2 ? (
      <h2 className="text-sm font-medium text-slate-500">{label}</h2>
    ) : labelHeadingLevel === 3 ? (
      <h3 className="text-sm font-medium text-slate-500">{label}</h3>
    ) : (
      <p className="text-sm text-slate-500">{label}</p>
    );

  const body = (
    <div data-tone={tone} className="finance-metric-card flex h-full gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
      <div
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg ${toneIcon[tone]}`}
        aria-hidden
      >
        {icon ?? "€"}
      </div>
      <div className="min-w-0 flex-1">
        {labelNode}
        <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
          {display}
        </p>
        {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-2xl transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        {body}
      </Link>
    );
  }

  return body;
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
  );
}
