import { ContentLoadingFallback, type ContentLoadingShape } from "./content-loading-fallback";
import { RouteSegmentLoading } from "./route-segment-loading";

type PageSuspenseFallbackProps = {
  /** Forma conhecida do bloco principal; omitir quando a estrutura ainda não está definida. */
  shape?: ContentLoadingShape;
  routeLabel?: string;
};

/** Suspense dentro de `page.tsx`: shell estrutural se houver forma; senão fallback genérico. */
export function PageSuspenseFallback({ shape, routeLabel }: PageSuspenseFallbackProps) {
  if (shape) return <ContentLoadingFallback shape={shape} />;
  return <RouteSegmentLoading label={routeLabel} />;
}
