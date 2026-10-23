import { context, propagation, trace, SpanStatusCode, type Span } from "@opentelemetry/api";

const TRACER_NAME = "fintwin";

export function parseTraceParent(header: string | null): { traceId: string; spanId: string } | null {
  if (!header) return null;
  const match = header.match(/^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i);
  if (!match) return null;
  return { traceId: match[1], spanId: match[2] };
}

export function newTraceIds(): { traceId: string; spanId: string; traceparent: string } {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const traceId = [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const spanId = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { traceId, spanId, traceparent: `00-${traceId}-${spanId}-01` };
}

export function startSpan(name: string, attributes?: Record<string, string>): Span {
  const tracer = trace.getTracer(TRACER_NAME);
  return tracer.startSpan(name, { attributes });
}

export async function withSpan<T>(name: string, fn: (span: Span) => Promise<T> | T): Promise<T> {
  const span = startSpan(name);
  try {
    const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    span.end();
  }
}

export function injectTraceHeaders(headers: Headers) {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  for (const [k, v] of Object.entries(carrier)) headers.set(k, v);
}
