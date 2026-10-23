import Link from "next/link";
import type { ReactNode } from "react";
import { formatEUR } from "@/lib/finance/money";

export type KpiTone = "accent" | "income" | "expense" | "analytic";

const iconWrap: Record<KpiTone, string> = {
  accent: "bg-emerald-100 text-emerald-700",
  income: "bg-blue-100 text-blue-700",
  expense: "bg-rose-100 text-rose-700",
  analytic: "bg-violet-100 text-violet-700",
};

type DashboardKpiCardProps = {
  label: string;
  value: string;
  tone: KpiTone;
  icon: ReactNode;
  href?: string;
  trendLabel?: string | null;
  trendPositive?: boolean | null;
  rawValue?: boolean;
};

export function DashboardKpiCard({
  label,
  value,
  tone,
  icon,
  href,
  trendLabel,
  trendPositive,
  rawValue = false,
}: DashboardKpiCardProps) {
  const display = rawValue || value.includes("€") ? value : formatEUR(value);

  const card = (
    <div data-tone={tone} className="finance-metric-card flex h-full min-h-[5.75rem] items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
      <div
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-xl ${iconWrap[tone]}`}
        aria-hidden
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight text-slate-900 sm:text-2xl dark:text-slate-50">
          {display}
        </p>
        {trendLabel ? (
          <p
            className={`mt-0.5 text-xs font-medium ${
              trendPositive === true
                ? "text-emerald-600"
                : trendPositive === false
                  ? "text-rose-600"
                  : "text-slate-500"
            }`}
          >
            {trendLabel}
          </p>
        ) : null}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block h-full rounded-2xl transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        {card}
      </Link>
    );
  }

  return card;
}
