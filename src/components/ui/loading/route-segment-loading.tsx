import { ChartSkeleton, KpiSkeletonGrid } from "@/components/ui/skeleton";

import { AppShellSkeleton } from "./app-shell-skeleton";

type RouteSegmentLoadingProps = {
  /** Texto para leitores de ecrã */
  label?: string;
};

/** Mantém a geometria da página visível enquanto o conteúdo real é preparado. */
export function RouteSegmentLoading({ label = "A carregar página" }: RouteSegmentLoadingProps) {
  return (
    <AppShellSkeleton label={label}>
      <div className="space-y-5" aria-hidden>
        <KpiSkeletonGrid />
        <div className="grid min-w-0 gap-5 lg:grid-cols-5">
          <ChartSkeleton className="h-80 lg:col-span-3" />
          <ChartSkeleton className="h-80 lg:col-span-2" variant="donut" />
        </div>
      </div>
    </AppShellSkeleton>
  );
}
