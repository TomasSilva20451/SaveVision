import type { ReactNode } from "react";

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

type PageSkeletonVariant = "dashboard" | "transactions" | "accounts" | "expenses" | "income";

export function PageSkeleton({ variant }: { variant: PageSkeletonVariant }) {
  const shell = (body: ReactNode) => (
    <div className="min-w-0 p-4 sm:p-6 lg:p-8" aria-busy="true" aria-label="A carregar conteúdo">
      <Skeleton className="h-8 w-56 max-w-full" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      {body}
    </div>
  );

  switch (variant) {
    case "dashboard":
      return shell(
        <>
          <div className="mt-6">
            <KpiSkeletonGrid />
          </div>
          <div className="mt-6 grid min-w-0 gap-4 lg:grid-cols-2">
            <ChartSkeleton className="h-72" />
            <ChartSkeleton className="h-72" />
          </div>
          <div className="mt-4">
            <TableSkeleton rows={5} cols={3} />
          </div>
        </>,
      );
    case "accounts":
      return shell(
        <>
          <div className="mt-6">
            <KpiSkeletonGrid count={3} />
          </div>
          <div className="mt-6">
            <ChartSkeleton className="h-64" />
          </div>
          <div className="mt-4">
            <TableSkeleton rows={4} cols={5} />
          </div>
        </>,
      );
    case "transactions":
      return shell(
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="mt-4">
            <ChartSkeleton className="h-56" />
          </div>
          <div className="mt-4">
            <TableSkeleton rows={8} cols={5} />
          </div>
        </>,
      );
    case "expenses":
      return shell(
        <>
          <div className="mt-6">
            <KpiSkeletonGrid />
          </div>
          <div className="mt-6 grid min-w-0 gap-4 lg:grid-cols-2">
            <ChartSkeleton className="h-64" />
            <ChartSkeleton className="h-64" />
          </div>
          <div className="mt-4">
            <TableSkeleton rows={6} cols={4} />
          </div>
        </>,
      );
    case "income":
      return shell(
        <>
          <div className="mt-6">
            <KpiSkeletonGrid count={3} />
          </div>
          <div className="mt-4">
            <TableSkeleton rows={6} cols={4} />
          </div>
        </>,
      );
    default:
      return shell(
        <div className="mt-6">
          <TableSkeleton />
        </div>,
      );
  }
}
