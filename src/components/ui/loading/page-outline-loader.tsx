import type { ReactNode } from "react";

type PageOutlineLoaderProps = {
  children?: ReactNode;
  label?: string;
};

/** Contorno suave da área útil — pulsa enquanto o conteúdo carrega. */
export function PageOutlineLoader({
  children,
  label = "A carregar página",
}: PageOutlineLoaderProps) {
  return (
    <div
      className="relative min-h-[min(72vh,40rem)] p-4 sm:space-y-6 sm:p-6 lg:p-8"
      aria-busy="true"
      role="status"
      aria-live="polite"
    >
      <div
        className="pointer-events-none absolute inset-3 sm:inset-4 page-load-outline rounded-[1.15rem]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-3 top-3 h-0.5 overflow-hidden rounded-full bg-slate-100 sm:inset-x-4 sm:top-4 dark:bg-slate-800"
        aria-hidden
      >
        <div className="route-load-bar h-full w-1/3 bg-blue-500/80 dark:bg-blue-400/80" />
      </div>
      <div className="relative z-[1] min-w-0">{children}</div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
