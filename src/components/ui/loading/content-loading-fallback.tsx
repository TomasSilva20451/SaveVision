import {
  ChartSkeleton,
  KpiSkeletonGrid,
  Skeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";

import { AppShellSkeleton } from "./app-shell-skeleton";

export type ContentLoadingShape =
  | "dashboard"
  | "transactions"
  | "accounts"
  | "expenses"
  | "income"
  | "table"
  | "chat-panel";

type ContentLoadingFallbackProps = {
  shape: ContentLoadingShape;
};

function ShapeBody({ shape }: { shape: ContentLoadingShape }) {
  switch (shape) {
    case "dashboard":
      return (
        <>
          <KpiSkeletonGrid />
          <div className="grid min-w-0 gap-5 lg:grid-cols-5">
            <ChartSkeleton className="h-80 lg:col-span-3" />
            <ChartSkeleton className="h-80 lg:col-span-2" variant="donut" shimmerDelayMs={230} />
          </div>
          <TableSkeleton rows={5} cols={3} />
        </>
      );
    case "accounts":
      return (
        <>
          <KpiSkeletonGrid count={3} />
          <ChartSkeleton className="h-64" />
          <TableSkeleton rows={4} cols={5} />
        </>
      );
    case "transactions":
      return (
        <>
          <Skeleton className="h-3 w-[34rem] max-w-[90%]" />
          <KpiSkeletonGrid />
          <div className="grid min-w-0 gap-5 lg:grid-cols-5">
            <ChartSkeleton className="h-[22rem] lg:col-span-3" />
            <ChartSkeleton className="h-[22rem] lg:col-span-2" variant="donut" shimmerDelayMs={230} />
          </div>
          <TableSkeleton rows={8} cols={5} />
        </>
      );
    case "expenses":
      return (
        <>
          <KpiSkeletonGrid />
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <ChartSkeleton className="h-64" />
            <ChartSkeleton className="h-64" shimmerDelayMs={230} />
          </div>
          <TableSkeleton rows={6} cols={4} />
        </>
      );
    case "income":
      return (
        <>
          <KpiSkeletonGrid count={3} />
          <TableSkeleton rows={6} cols={4} />
        </>
      );
    case "table":
      return <TableSkeleton rows={8} cols={4} />;
    case "chat-panel":
      return (
        <div className="max-w-3xl space-y-4">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      );
    default:
      return <TableSkeleton />;
  }
}

/** Skeleton estrutural imediato para manter o shell estável durante streaming. */
export function ContentLoadingFallback({ shape }: ContentLoadingFallbackProps) {
  return (
    <AppShellSkeleton label="A carregar conteúdo">
      <div className="min-w-0 space-y-4 sm:space-y-5">
        <ShapeBody shape={shape} />
      </div>
    </AppShellSkeleton>
  );
}
