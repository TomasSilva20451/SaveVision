import {
  ChartSkeleton,
  KpiSkeletonGrid,
  Skeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";

import { DelayedSkeleton } from "./delayed-skeleton";

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
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <ChartSkeleton className="h-72" />
            <ChartSkeleton className="h-72" />
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
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-32" />
          </div>
          <ChartSkeleton className="h-56" />
          <TableSkeleton rows={8} cols={5} />
        </>
      );
    case "expenses":
      return (
        <>
          <KpiSkeletonGrid />
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <ChartSkeleton className="h-64" />
            <ChartSkeleton className="h-64" />
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

/** Skeleton de conteúdo com forma conhecida, só após atraso — usar em Suspense dentro da página. */
export function ContentLoadingFallback({ shape }: ContentLoadingFallbackProps) {
  return (
    <DelayedSkeleton>
      <div
        className="min-w-0 space-y-4 p-4 sm:space-y-6 sm:p-6 lg:p-8"
        aria-busy="true"
        aria-label="A carregar conteúdo"
      >
        <ShapeBody shape={shape} />
      </div>
    </DelayedSkeleton>
  );
}
