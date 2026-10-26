import { Suspense, type ReactNode } from "react";

type RequestDynamicPageProps = {
  fallback?: ReactNode;
  children: ReactNode;
};

/** Envolve páginas que chamam `connection()` / auth para cumprir Cache Components + prerender. */
export function RequestDynamicPage({ fallback, children }: RequestDynamicPageProps) {
  return (
    <Suspense
      fallback={
        fallback ?? (
          <p className="p-6 text-sm text-slate-600 dark:text-slate-300">A carregar…</p>
        )
      }
    >
      {children}
    </Suspense>
  );
}
