import Link from "next/link";
import { formatEUR } from "@/lib/finance/money";
import { safePercentChange } from "@/lib/finance/kpi";

export function MetricCard({
  label,
  value,
  previous,
  highlight = false,
  href,
}: {
  label: string;
  value: string;
  previous?: string;
  highlight?: boolean;
  href?: string;
}) {
  const change =
    previous != null ? safePercentChange(value, previous) : null;

  const body = (
    <div
      className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] ${
        href ? "transition hover:border-blue-200" : ""
      }`}
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${highlight ? "text-blue-700" : "text-slate-900 dark:text-slate-50"}`}>
        {formatEUR(value)}
      </p>
      {change != null ? (
        <p className="mt-1 text-xs text-slate-500">
          {change >= 0 ? "+" : ""}
          {change}% vs mês anterior
        </p>
      ) : previous != null ? (
        <p className="mt-1 text-xs text-slate-500">
          Sem base de comparação
        </p>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100">
        {body}
      </Link>
    );
  }

  return body;
}
