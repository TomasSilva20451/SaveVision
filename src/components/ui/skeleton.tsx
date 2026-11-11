function skeletonClass(extra = "") {
  return `animate-pulse rounded-md bg-slate-200/80 dark:bg-slate-700/60 ${extra}`;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={skeletonClass(className)} />;
}

export function ChartSkeleton({ className = "h-64" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`${skeletonClass("w-full")} ${className}`}
      role="presentation"
    />
  );
}

export function KpiSkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]"
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-8 w-32" />
          <Skeleton className="mt-2 h-3 w-40" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
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
