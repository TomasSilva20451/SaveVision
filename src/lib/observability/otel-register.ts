import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

let started = false;

export function startOpenTelemetry() {
  if (started || process.env.FINTWIN_OTEL_ENABLED !== "1") return;
  started = true;
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://127.0.0.1:4318";
  const serviceName = process.env.OTEL_SERVICE_NAME ?? process.env.APP_NAME ?? "fintwin";
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: process.env.FINTWIN_BUILD_SHA ?? "dev",
      "deployment.environment": process.env.FINTWIN_ENV ?? process.env.NODE_ENV ?? "development",
    }),
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
        exportIntervalMillis: 60_000,
      }),
    ],
  });
  sdk.start();
  process.on("SIGTERM", () => {
    void sdk.shutdown();
  });
}
