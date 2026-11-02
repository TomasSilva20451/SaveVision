import { Suspense, type ReactNode } from "react";

import { PageSuspenseFallback, type ContentLoadingShape } from "@/components/ui/loading";

type RequestDynamicPageProps = {
  fallback?: ReactNode;
  /** Skeleton atrasado quando a forma do conteúdo é conhecida. */
  contentShape?: ContentLoadingShape;
  children: ReactNode;
};

/** Envolve páginas que chamam `connection()` / auth para cumprir Cache Components + prerender. */
export function RequestDynamicPage({ fallback, contentShape, children }: RequestDynamicPageProps) {
  return (
    <Suspense
      fallback={fallback ?? <PageSuspenseFallback shape={contentShape} />}
    >
      {children}
    </Suspense>
  );
}
