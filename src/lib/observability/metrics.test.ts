import { describe, expect, it } from "vitest";
import { observeHistogram, recordLoginMetric, renderPrometheusMetrics } from "@/lib/observability/metrics";

describe("metrics", () => {
  it("expõe contadores Prometheus", () => {
    recordLoginMetric("success", 120);
    const text = renderPrometheusMetrics();
    expect(text).toContain("fintwin_login_attempts_total");
    expect(text).toContain("result=success");
    expect(text).toContain("fintwin_process_uptime_seconds");
  });

  it("regista histogramas", () => {
    observeHistogram("fintwin_http_request_duration_seconds", 0.2, { route: "/api/health" });
    const text = renderPrometheusMetrics();
    expect(text).toContain("fintwin_http_request_duration_seconds_bucket");
    expect(text).toMatch(/le="0\.25"/);
    expect(text).toContain('le="+Inf"');
  });
});
