import { ContentLoadingFallback, type ContentLoadingShape } from "./content-loading-fallback";

type RouteSegmentLoadingProps = {
  /** Texto para leitores de ecrã */
  label?: string;
  shape?: ContentLoadingShape;
};

/** Navegação de rota: contorno pulsante + silhueta do layout (forma conhecida). */
export function RouteSegmentLoading({
  label = "A carregar página",
  shape = "table",
}: RouteSegmentLoadingProps) {
  return <ContentLoadingFallback shape={shape} routeLabel={label} />;
}
