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
      className={`rounded-xl border p-4 shadow-sm ${
        highlight
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      } ${href ? "transition hover:border-zinc-400 dark:hover:border-zinc-600" : ""}`}
    >
      <p className={`text-sm ${highlight ? "opacity-80" : "text-zinc-500"}`}>{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{formatEUR(value)}</p>
      {change != null ? (
        <p className={`mt-1 text-xs ${highlight ? "opacity-80" : "text-zinc-500"}`}>
          {change >= 0 ? "+" : ""}
          {change}% vs mês anterior
        </p>
      ) : previous != null ? (
        <p className={`mt-1 text-xs ${highlight ? "opacity-80" : "text-zinc-500"}`}>
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
