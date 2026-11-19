import type { CSSProperties, ReactNode } from "react";
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
  | "analytics"
  | "assistant"
  | "simulations"
  | "forecast"
  | "intelligence"
  | "open-banking"
  | "audit"
  | "investments"
  | "profile"
  | "table"
  | "chat-panel";

type ContentLoadingFallbackProps = { shape: ContentLoadingShape };

function Surface({ children, className = "", delay = 120 }: { children?: ReactNode; className?: string; delay?: number }) {
  return (
    <div
      className={`loading-skeleton-surface overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] ${className}`}
      style={{ "--skeleton-shimmer-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}

function FilterSkeleton() {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-10 w-full rounded-xl" />)}</div>;
}

function ProfileSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)]">
      <Surface className="min-h-[32rem]">
        <Skeleton className="h-5 w-40" />
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, index) => <div key={index} className={index < 2 ? "sm:col-span-2" : ""}><Skeleton className="h-3 w-28" /><Skeleton className="mt-2 h-11 w-full rounded-xl" /></div>)}
        </div>
      </Surface>
      <div className="space-y-5">
        <Surface className="min-h-56" delay={220}><Skeleton className="h-5 w-36" /><Skeleton className="mx-auto mt-6 h-24 w-24 rounded-3xl" /><Skeleton className="mx-auto mt-4 h-4 w-32" /></Surface>
        <Surface className="min-h-32" delay={320}><Skeleton className="h-5 w-28" /><Skeleton className="mt-4 h-3 w-full" /><Skeleton className="mt-2 h-3 w-4/5" /></Surface>
        <Surface className="min-h-32" delay={420}><Skeleton className="h-5 w-28" /><Skeleton className="mt-4 h-3 w-full" /><Skeleton className="mt-2 h-3 w-3/4" /></Surface>
      </div>
    </div>
  );
}

function ShapeBody({ shape }: { shape: ContentLoadingShape }) {
  switch (shape) {
    case "dashboard":
      return <><KpiSkeletonGrid /><Surface className="min-h-44 lg:w-1/2"><Skeleton className="h-5 w-36" /><Skeleton className="mt-3 h-4 w-72 max-w-full" /><Skeleton className="mt-6 h-2 w-full rounded-full" /><Skeleton className="mt-4 h-10 w-44 rounded-xl" /></Surface><div className="grid min-w-0 gap-5 lg:grid-cols-5"><ChartSkeleton className="h-80 lg:col-span-3" /><ChartSkeleton className="h-80 lg:col-span-2" variant="donut" shimmerDelayMs={230} /></div><div className="grid gap-5 lg:grid-cols-2"><TableSkeleton rows={5} cols={3} /><TableSkeleton rows={5} cols={3} /></div></>;
    case "accounts":
      return <><KpiSkeletonGrid count={3} /><ChartSkeleton className="h-64" /><TableSkeleton rows={6} cols={5} /></>;
    case "transactions":
      return <><Skeleton className="h-3 w-[34rem] max-w-[90%]" /><KpiSkeletonGrid /><div className="grid min-w-0 gap-5 lg:grid-cols-5"><ChartSkeleton className="h-[22rem] lg:col-span-3" /><ChartSkeleton className="h-[22rem] lg:col-span-2" variant="donut" shimmerDelayMs={230} /></div><Surface><FilterSkeleton /></Surface><TableSkeleton rows={10} cols={5} /></>;
    case "expenses":
      return <><KpiSkeletonGrid /><Surface><Skeleton className="h-3 w-80 max-w-full" /><div className="mt-4 flex justify-end gap-2"><Skeleton className="h-10 w-36 rounded-xl" /><Skeleton className="h-10 w-36 rounded-xl" /></div></Surface><div className="grid min-w-0 gap-5 lg:grid-cols-5"><ChartSkeleton className="h-72 lg:col-span-3" /><ChartSkeleton className="h-72 lg:col-span-2" variant="donut" shimmerDelayMs={230} /></div><TableSkeleton rows={10} cols={5} /></>;
    case "income":
      return <><KpiSkeletonGrid /><div className="grid min-w-0 gap-5 lg:grid-cols-5"><ChartSkeleton className="h-72 lg:col-span-3" /><ChartSkeleton className="h-72 lg:col-span-2" variant="donut" shimmerDelayMs={230} /></div><div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(18rem,1fr)]"><TableSkeleton rows={8} cols={6} /><Surface className="min-h-[26rem]" delay={340}><Skeleton className="h-5 w-40" />{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="mt-5 h-12 w-full rounded-xl" />)}</Surface></div></>;
    case "analytics":
      return <><Surface className="p-3"><div className="flex gap-3 overflow-hidden">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-9 w-28 shrink-0 rounded-xl" />)}</div></Surface><KpiSkeletonGrid /><div className="grid gap-5 lg:grid-cols-2"><ChartSkeleton className="h-80" /><ChartSkeleton className="h-80" variant="donut" shimmerDelayMs={230} /></div><div className="grid gap-5 lg:grid-cols-3"><Surface className="h-56" /><Surface className="h-56" delay={220} /><Surface className="h-56" delay={340} /></div></>;
    case "assistant":
    case "chat-panel":
      return <Surface className="max-w-3xl min-h-[34rem]"><div className="flex justify-between gap-4"><div className="w-full"><Skeleton className="h-5 w-52" /><Skeleton className="mt-3 h-3 w-full" /><Skeleton className="mt-2 h-3 w-4/5" /></div><Skeleton className="h-8 w-24 shrink-0 rounded-full" /></div><Skeleton className="mt-7 h-24 w-full rounded-xl" /><div className="mt-3 flex flex-wrap gap-2">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-9 w-40 rounded-xl" />)}</div><Skeleton className="mt-8 h-40 w-full rounded-2xl" /></Surface>;
    case "simulations":
      return <><Surface className="min-h-[9rem]"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-16 w-full rounded-xl" />)}</div></Surface><div className="grid gap-5 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]"><Surface className="min-h-[30rem]"><Skeleton className="h-5 w-48" />{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="mt-5 h-11 w-full rounded-xl" />)}</Surface><Surface className="min-h-[30rem]" delay={230}><Skeleton className="h-5 w-44" /><div className="mt-6 grid gap-3 sm:grid-cols-2"><Skeleton className="h-28 w-full rounded-xl" /><Skeleton className="h-28 w-full rounded-xl" /></div><Skeleton className="mt-6 h-56 w-full rounded-xl" /></Surface></div></>;
    case "forecast":
      return <><KpiSkeletonGrid /><div className="grid gap-5 xl:grid-cols-[minmax(0,2.1fr)_minmax(18rem,0.9fr)]"><ChartSkeleton className="h-[25rem]" /><Surface className="h-[25rem]" delay={230}><Skeleton className="h-5 w-44" />{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="mt-5 h-20 w-full rounded-xl" />)}</Surface></div><div className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(18rem,1fr)]"><TableSkeleton rows={6} cols={5} /><Surface className="min-h-80" delay={340}><Skeleton className="h-5 w-48" />{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="mt-5 h-14 w-full rounded-xl" />)}</Surface></div></>;
    case "intelligence":
      return <><KpiSkeletonGrid count={3} /><div className="grid gap-5 lg:grid-cols-2"><Surface className="min-h-64"><Skeleton className="h-4 w-48" /><Skeleton className="mt-4 h-8 w-32" />{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="mt-5 h-3 w-full" />)}</Surface><Surface className="min-h-64" delay={230}><Skeleton className="h-4 w-48" /><Skeleton className="mt-4 h-8 w-72 max-w-full" />{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="mt-5 h-3 w-full" />)}</Surface></div><Surface className="min-h-52" delay={340}><Skeleton className="h-5 w-48" /><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-16 w-full rounded-xl" />)}</div></Surface></>;
    case "open-banking":
      return <div className="grid gap-5 lg:grid-cols-[minmax(19rem,0.8fr)_minmax(0,1.2fr)]"><Surface className="min-h-[31rem]"><Skeleton className="h-5 w-48" />{Array.from({ length: 3 }, (_, index) => <div key={index} className="mt-5"><Skeleton className="h-3 w-28" /><Skeleton className="mt-2 h-11 w-full rounded-xl" /></div>)}</Surface><Surface className="min-h-[31rem]" delay={230}><Skeleton className="h-5 w-52" />{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="mt-5 h-14 w-full rounded-xl" />)}</Surface></div>;
    case "audit":
      return <><Surface className="min-h-36"><Skeleton className="h-5 w-52" /><Skeleton className="mt-3 h-3 w-96 max-w-full" /><Skeleton className="mt-5 h-10 w-44 rounded-xl" /></Surface><Surface className="p-4"><FilterSkeleton /></Surface><TableSkeleton rows={10} cols={4} /></>;
    case "investments":
      return <><KpiSkeletonGrid /><Surface className="min-h-20"><Skeleton className="h-3 w-full" /><Skeleton className="mt-2 h-3 w-3/4" /></Surface><div className="grid gap-5 lg:grid-cols-5"><ChartSkeleton className="h-72 lg:col-span-2" variant="donut" /><Surface className="h-72 lg:col-span-3" delay={230}><Skeleton className="h-5 w-56" /><div className="mt-6 grid gap-3 sm:grid-cols-3"><Skeleton className="h-36 w-full rounded-xl" /><Skeleton className="h-36 w-full rounded-xl" /><Skeleton className="h-36 w-full rounded-xl" /></div></Surface></div><TableSkeleton rows={8} cols={7} /></>;
    case "profile":
      return <ProfileSkeleton />;
    case "table":
      return <><Surface><FilterSkeleton /></Surface><TableSkeleton rows={10} cols={4} /></>;
    default:
      return <TableSkeleton rows={10} />;
  }
}

export function ContentLoadingFallback({ shape }: ContentLoadingFallbackProps) {
  return <AppShellSkeleton label="A carregar conteúdo"><div className="min-h-[calc(100dvh-8rem)] min-w-0 space-y-4 sm:space-y-5"><ShapeBody shape={shape} /></div></AppShellSkeleton>;
}
