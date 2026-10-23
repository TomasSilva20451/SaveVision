import type { Instrumentation } from "next";
import { incrementCounter } from "@/lib/observability/metrics";
import { log } from "@/lib/observability/logger";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startOpenTelemetry } = await import("@/lib/observability/otel-register");
    startOpenTelemetry();
    log.info("observability.registered", {
      event: "observability_startup",
      meta: {
        otel: process.env.FINTWIN_OTEL_ENABLED === "1",
        env: process.env.FINTWIN_ENV ?? "development",
      },
    });
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const route = context.routePath ?? request.path;
  incrementCounter("fintwin_http_errors_total", { route: normalizeRoute(route) });
  log.error("http.request_error", {
    route: normalizeRoute(route),
    event: "request_error",
    error: {
      name: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : String(error),
      digest: typeof error === "object" && error && "digest" in error ? String(error.digest) : undefined,
    },
    meta: {
      method: request.method,
      routerKind: context.routeType,
    },
  });
};

function normalizeRoute(route: string) {
  try {
    const url = route.startsWith("http") ? new URL(route) : null;
    return url?.pathname ?? route.split("?")[0] ?? "unknown";
  } catch {
    return "unknown";
  }
}
