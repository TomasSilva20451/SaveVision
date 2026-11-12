"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/ui/skeleton";
import type { AccountsChartsProps } from "@/components/accounts/accounts-charts-content";

const AccountsChartsContent = dynamic(
  () =>
    import("@/components/accounts/accounts-charts-content").then(
      (module) => module.AccountsChartsContent,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="grid min-w-0 gap-5 lg:grid-cols-5">
        <ChartSkeleton className="h-72 lg:col-span-3" />
        <ChartSkeleton className="h-72 lg:col-span-2" shimmerDelayMs={230} />
      </div>
    ),
  },
);

export function AccountsCharts(props: AccountsChartsProps) {
  return <AccountsChartsContent {...props} />;
}
