import type { CSSProperties } from "react";

function skeletonClass(extra = "") {
  return `loading-skeleton-shape rounded-md ${extra}`;
}

function shimmerStyle(delayMs: number): CSSProperties {
  return { "--skeleton-shimmer-delay": `${delayMs}ms` } as CSSProperties;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={skeletonClass(className)} />;
}

export function ChartSkeleton({
  className = "h-64",
  variant = "bars",
  shimmerDelayMs = 120,
}: {
  className?: string;
  variant?: "bars" | "donut";
  shimmerDelayMs?: number;
}) {
  return (
    <div
      aria-hidden
      className={`loading-skeleton-surface overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] ${className}`}
      role="presentation"
      style={shimmerStyle(shimmerDelayMs)}
    >
      <Skeleton className="h-5 w-44 max-w-[70%]" />
      <Skeleton className="mt-2 h-3 w-64 max-w-[85%]" />
      {variant === "donut" ? (
        <div className="mt-6 flex items-center justify-center gap-6">
          <span className="loading-skeleton-ring h-36 w-36 shrink-0 rounded-full" />
          <span className="hidden min-w-32 flex-1 space-y-3 sm:block">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-3/5" />
          </span>
        </div>
      ) : (
        <div className="loading-skeleton-chart mt-6 flex h-[calc(100%-5.5rem)] min-h-32 items-end gap-3 px-3 pb-1">
          {[42, 68, 54, 86, 62, 76, 48].map((height, index) => (
            <span
              className="loading-skeleton-shape min-w-3 flex-1 rounded-t-md"
              key={`${height}-${index}`}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function KpiSkeletonGrid({ count = 4 }: { count?: number }) {
  const tones = ["income", "expense", "accent", "analytic"] as const;

  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          data-tone={tones[index % tones.length]}
          className="loading-skeleton-surface finance-metric-card flex min-h-[5.75rem] items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]"
          style={shimmerStyle(index * 110)}
        >
          <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
          <span className="min-w-0 flex-1">
            <Skeleton className="h-3 w-24 max-w-full" />
            <Skeleton className="mt-2 h-7 w-28 max-w-full" />
            <Skeleton className="mt-2 h-3 w-32 max-w-full" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div
      className="loading-skeleton-surface overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]"
      style={shimmerStyle(280)}
    >
      <Skeleton className="h-5 w-48" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="flex gap-3">
            {Array.from({ length: cols }, (_, col) => (
              <Skeleton key={col} className={`h-4 flex-1 ${col === cols - 1 ? "max-w-[5rem]" : ""}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
