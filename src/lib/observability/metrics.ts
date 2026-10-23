type Labels = Record<string, string>;

type CounterDef = { name: string; help: string; labels: string[] };
type HistogramDef = { name: string; help: string; labels: string[]; buckets: number[] };

const COUNTERS: CounterDef[] = [
  { name: "fintwin_login_attempts_total", help: "Tentativas de login", labels: ["result"] },
  { name: "fintwin_http_requests_total", help: "Pedidos HTTP", labels: ["route", "status"] },
  { name: "fintwin_http_errors_total", help: "Respostas 5xx", labels: ["route"] },
  { name: "fintwin_transactions_total", help: "Transacções persistidas", labels: ["kind"] },
  { name: "fintwin_jobs_total", help: "Jobs batch/cron", labels: ["job", "result"] },
];

const HISTOGRAMS: HistogramDef[] = [
  {
    name: "fintwin_http_request_duration_seconds",
    help: "Latência HTTP",
    labels: ["route"],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  },
  {
    name: "fintwin_login_duration_seconds",
    help: "Latência authorize login",
    labels: ["result"],
    buckets: [0.1, 0.25, 0.5, 1, 2, 5],
  },
];

const counterValues = new Map<string, number>();
const histogramValues = new Map<string, number[]>();

function key(name: string, labels: Labels) {
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}=${labels[k]}`);
  return `${name}{${parts.join(",")}}`;
}

export function incrementCounter(name: string, labels: Labels = {}, by = 1) {
  const k = key(name, labels);
  counterValues.set(k, (counterValues.get(k) ?? 0) + by);
}

export function observeHistogram(name: string, valueSeconds: number, labels: Labels = {}) {
  const k = key(name, labels);
  const list = histogramValues.get(k) ?? [];
  list.push(valueSeconds);
  histogramValues.set(k, list);
}

export function recordLoginMetric(result: "success" | "failure" | "blocked" | "mfa_required", durationMs: number) {
  incrementCounter("fintwin_login_attempts_total", { result });
  observeHistogram("fintwin_login_duration_seconds", durationMs / 1000, { result });
}

export function recordHttpMetric(route: string, status: number, durationMs: number) {
  const statusLabel = String(status);
  incrementCounter("fintwin_http_requests_total", { route, status: statusLabel });
  if (status >= 500) incrementCounter("fintwin_http_errors_total", { route });
  observeHistogram("fintwin_http_request_duration_seconds", durationMs / 1000, { route });
}

export function recordTransactionMetric(kind: string) {
  incrementCounter("fintwin_transactions_total", { kind });
}

export function recordJobMetric(job: string, result: "success" | "failure") {
  incrementCounter("fintwin_jobs_total", { job, result });
}

function formatLabels(labels: Labels) {
  const inner = Object.entries(labels)
    .map(([k, v]) => `${k}="${v.replace(/"/g, '\\"')}"`)
    .join(",");
  return inner ? `{${inner}}` : "";
}

export function renderPrometheusMetrics(): string {
  const lines: string[] = [];
  for (const def of COUNTERS) {
    lines.push(`# HELP ${def.name} ${def.help}`);
    lines.push(`# TYPE ${def.name} counter`);
    for (const [k, v] of counterValues) {
      if (!k.startsWith(`${def.name}{`)) continue;
      const labelPart = k.slice(def.name.length);
      lines.push(`${def.name}${labelPart} ${v}`);
    }
  }
  for (const def of HISTOGRAMS) {
    lines.push(`# HELP ${def.name} ${def.help}`);
    lines.push(`# TYPE ${def.name} histogram`);
    const byLabel = new Map<string, number[]>();
    for (const [k, values] of histogramValues) {
      if (!k.startsWith(`${def.name}{`)) continue;
      byLabel.set(k.slice(def.name.length), values);
    }
    for (const [labelPart, values] of byLabel) {
      let cumulative = 0;
      for (const bucket of def.buckets) {
        const count = values.filter((v) => v <= bucket).length;
        cumulative = count;
        lines.push(`${def.name}_bucket${labelPart.replace("}", `,le="${bucket}"}`)} ${count}`);
      }
      lines.push(`${def.name}_bucket${labelPart.replace("}", `,le="+Inf"`)} ${values.length}`);
      lines.push(`${def.name}_sum${labelPart} ${values.reduce((a, b) => a + b, 0)}`);
      lines.push(`${def.name}_count${labelPart} ${values.length}`);
    }
  }
  lines.push(`# HELP fintwin_process_uptime_seconds Uptime do processo Node`);
  lines.push(`# TYPE fintwin_process_uptime_seconds gauge`);
  lines.push(`fintwin_process_uptime_seconds ${process.uptime().toFixed(3)}`);
  return `${lines.join("\n")}\n`;
}

export function metricsSnapshotJson() {
  return {
    counters: Object.fromEntries(counterValues),
    histograms: Object.fromEntries(
      [...histogramValues.entries()].map(([k, v]) => [k, { count: v.length, sum: v.reduce((a, b) => a + b, 0) }]),
    ),
    uptimeSeconds: process.uptime(),
  };
}
