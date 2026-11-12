import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChartSkeleton, KpiSkeletonGrid, TableSkeleton } from "./skeleton";

describe("premium skeleton shimmer", () => {
  it("aplica a reflexão aos cartões KPI com um atraso progressivo", () => {
    const markup = renderToStaticMarkup(createElement(KpiSkeletonGrid, { count: 4 }));

    expect(markup.match(/loading-skeleton-surface/g)).toHaveLength(4);
    expect(markup).toContain("--skeleton-shimmer-delay:0ms");
    expect(markup).toContain("--skeleton-shimmer-delay:330ms");
  });

  it("mantém gráficos e tabelas dentro de superfícies recortadas", () => {
    const chart = renderToStaticMarkup(createElement(ChartSkeleton, { shimmerDelayMs: 180 }));
    const table = renderToStaticMarkup(createElement(TableSkeleton));

    expect(chart).toContain("loading-skeleton-surface overflow-hidden");
    expect(chart).toContain("--skeleton-shimmer-delay:180ms");
    expect(table).toContain("loading-skeleton-surface overflow-hidden");
  });
});
