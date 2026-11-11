type RouteSegmentLoadingProps = {
  /** Texto para leitores de ecrã */
  label?: string;
};

/** Mantém a geometria da página visível enquanto o conteúdo real é preparado. */
export function RouteSegmentLoading({ label = "A carregar página" }: RouteSegmentLoadingProps) {
  return (
    <div className="route-loading-frame" aria-busy="true" role="status" aria-live="polite">
      <div className="route-loading-outline" aria-hidden />
      <div className="route-loading-layout" aria-hidden>
        <div className="route-loading-heading">
          <span className="route-loading-shape h-8 w-52 max-w-[70%]" />
          <span className="route-loading-shape h-4 w-80 max-w-[90%]" />
        </div>
        <div className="route-loading-kpis">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="route-loading-card route-loading-kpi" key={index}>
              <span className="route-loading-shape h-11 w-11 rounded-xl" />
              <span className="min-w-0 flex-1 space-y-2">
                <span className="route-loading-shape block h-3 w-24 max-w-full" />
                <span className="route-loading-shape block h-7 w-32 max-w-full" />
              </span>
            </div>
          ))}
        </div>
        <div className="route-loading-panels">
          <div className="route-loading-card min-h-72 lg:col-span-3">
            <span className="route-loading-shape block h-5 w-48 max-w-[75%]" />
            <span className="route-loading-shape mt-6 block h-48 w-full" />
          </div>
          <div className="route-loading-card min-h-72 lg:col-span-2">
            <span className="route-loading-shape block h-5 w-40 max-w-[75%]" />
            <span className="route-loading-shape mx-auto mt-7 block h-40 w-40 rounded-full" />
          </div>
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
