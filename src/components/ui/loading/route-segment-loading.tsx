type RouteSegmentLoadingProps = {
  /** Texto para leitores de ecrã */
  label?: string;
};

/** Feedback mínimo em carregamentos de rota — não simula conteúdo nem usa spinner de página. */
export function RouteSegmentLoading({ label = "A carregar página" }: RouteSegmentLoadingProps) {
  return (
    <div className="relative min-h-[12rem]" aria-busy="true" role="status" aria-live="polite">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-slate-100 dark:bg-slate-800"
        aria-hidden
      >
        <div className="route-load-bar h-full w-1/3 bg-blue-500/90 dark:bg-blue-400/90" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
