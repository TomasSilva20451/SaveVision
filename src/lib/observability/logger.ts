import "server-only";
import { getRequestContext } from "@/lib/observability/request-context";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type StructuredLog = {
  ts: string;
  level: LogLevel;
  msg: string;
  service: string;
  env: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  journey?: string;
  event?: string;
  durationMs?: number;
  statusCode?: number;
  route?: string;
  error?: { name: string; message: string; digest?: string };
  meta?: Record<string, string | number | boolean | null>;
};

const SERVICE = process.env.APP_NAME ?? "FinTwin";

function emit(entry: StructuredLog) {
  const line = JSON.stringify(entry);
  if (entry.level === "error") console.error(line);
  else if (entry.level === "warn") console.warn(line);
  else console.log(line);
}

function base(level: LogLevel, msg: string, fields: Partial<StructuredLog> = {}) {
  const ctx = getRequestContext();
  emit({
    ts: new Date().toISOString(),
    level,
    msg,
    service: SERVICE,
    env: process.env.FINTWIN_ENV ?? process.env.NODE_ENV ?? "development",
    requestId: ctx?.requestId,
    traceId: ctx?.traceId,
    spanId: ctx?.spanId,
    ...fields,
  });
}

export const log = {
  debug: (msg: string, fields?: Partial<StructuredLog>) => base("debug", msg, fields),
  info: (msg: string, fields?: Partial<StructuredLog>) => base("info", msg, fields),
  warn: (msg: string, fields?: Partial<StructuredLog>) => base("warn", msg, fields),
  error: (msg: string, fields?: Partial<StructuredLog>) => base("error", msg, fields),
};

/** Formato consumível por SIEM (Elastic, Datadog, Loki, etc.). */
export function toSiemEnvelope(entry: StructuredLog) {
  return {
    "@timestamp": entry.ts,
    event: {
      kind: "event",
      category: ["application"],
      type: ["info"],
      outcome: entry.level === "error" ? "failure" : "success",
    },
    message: entry.msg,
    fintwin: entry,
    trace: entry.traceId ? { id: entry.traceId } : undefined,
  };
}
