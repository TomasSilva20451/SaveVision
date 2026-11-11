import type { ReactNode } from "react";

type AppShellSkeletonProps = {
  children: ReactNode;
  label: string;
};

const navWidths = ["w-28", "w-20", "w-24", "w-32", "w-20", "w-24", "w-20", "w-24", "w-20"];

/** Replica a geometria estável do AppShell sem depender de sessão ou dados. */
export function AppShellSkeleton({ children, label }: AppShellSkeletonProps) {
  return (
    <div
      className="app-shell aurora-shell flex min-h-full w-full max-w-[100vw] bg-[var(--background)]"
      aria-busy="true"
      aria-label={label}
      role="status"
      aria-live="polite"
    >
      <aside className="hidden w-[248px] shrink-0 flex-col bg-[var(--sidebar)] md:flex" aria-hidden>
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="brand-mark h-8 w-8 rounded-lg" />
          <span className="h-4 w-20 rounded-full bg-white/15" />
        </div>
        <div className="flex-1 space-y-1 px-3 py-1">
          {navWidths.map((width, index) => (
            <div
              className={`flex h-10 items-center gap-3 rounded-xl px-3 ${index === 2 ? "bg-blue-600/80" : ""}`}
              key={`${width}-${index}`}
            >
              <span className="h-4 w-4 rounded bg-white/12" />
              <span className={`h-3 rounded-full bg-white/12 ${width}`} />
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 p-3">
          <div className="flex h-14 items-center gap-3 rounded-2xl bg-white/10 px-3">
            <span className="h-9 w-9 rounded-xl bg-blue-500/45" />
            <span className="space-y-2">
              <span className="block h-3 w-20 rounded-full bg-white/15" />
              <span className="block h-2 w-24 rounded-full bg-white/10" />
            </span>
          </div>
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col overflow-x-clip">
        <header className="app-header flex flex-wrap items-center gap-3 px-4 py-2.5 md:px-8" aria-hidden>
          <div className="order-3 w-full min-w-0 space-y-2 md:order-none md:w-auto md:min-w-60 md:flex-1">
            <span className="loading-skeleton-shape block h-7 w-44 rounded-lg" />
            <span className="loading-skeleton-shape block h-3 w-72 max-w-[80%] rounded-full" />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="loading-skeleton-shape h-10 w-12 rounded-xl" />
            <span className="loading-skeleton-shape h-10 w-28 rounded-xl" />
            <span className="loading-skeleton-shape h-12 w-40 rounded-2xl" />
          </div>
        </header>
        <main className="app-content mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 pb-10 md:px-8">
          {children}
        </main>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
