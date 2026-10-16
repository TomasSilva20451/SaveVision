"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatEUR } from "@/lib/finance/money";
import { treasuryEventSourceLabel, type TreasuryEventSource } from "@/lib/finance/treasury-forecast";

type TimelinePoint = {
  civilDate: string;
  projectedBalance: string;
};

type EventRow = {
  label: string;
  civilDate: string;
  amount: string;
  direction: "inflow" | "outflow";
  source: TreasuryEventSource;
  movementKind: "PREVISTO";
  balanceAfter: string;
};

type TreasuryForecastPanelProps = {
  horizonDays: number;
  realBalance: string;
  projectedBalance: string;
  expectedInflows: string;
  expectedOutflows: string;
  limitationNotice: string;
  sourcesIncluded: string[];
  sourcesExcluded: string[];
  timeline: TimelinePoint[];
  events: EventRow[];
};

export function TreasuryForecastPanel({
  horizonDays,
  realBalance,
  projectedBalance,
  expectedInflows,
  expectedOutflows,
  limitationNotice,
  sourcesIncluded,
  sourcesExcluded,
  timeline,
  events,
}: TreasuryForecastPanelProps) {
  const chartData = timeline.map((point) => ({
    date: point.civilDate,
    saldo: Number.parseFloat(point.projectedBalance),
  }));

  return (
    <div className="space-y-8">
      <div
        className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
        role="note"
      >
        {limitationNotice}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Saldo real (realizado)</p>
          <p className="text-xl font-semibold" data-testid="treasury-real-balance">
            {formatEUR(realBalance)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Saldo projetado ({horizonDays} dias)</p>
          <p className="text-xl font-semibold" data-testid="treasury-projected-balance">
            {formatEUR(projectedBalance)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Entradas previstas</p>
          <p className="text-xl font-semibold">{formatEUR(expectedInflows)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Saídas previstas</p>
          <p className="text-xl font-semibold">{formatEUR(expectedOutflows)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h3 className="text-sm font-medium">Evolução projetada do saldo</h3>
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) =>
                  formatEUR(String(typeof value === "number" ? value : Number(value)))
                }
              />
              <Line type="monotone" dataKey="saldo" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h3 className="text-sm font-medium">Cronologia de movimentos previstos</h3>
        <ul className="mt-3 divide-y text-sm dark:divide-zinc-800">
          {events.length === 0 ? (
            <li className="py-2 text-zinc-500">Sem movimentos previstos neste horizonte.</li>
          ) : (
            events.map((event) => (
              <li
                key={`${event.source}-${event.label}-${event.civilDate}-${event.amount}`}
                className="grid gap-1 py-3 sm:grid-cols-[1fr_auto]"
              >
                <div>
                  <p className="font-medium">
                    {event.label} · {event.civilDate}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {treasuryEventSourceLabel(event.source)} · {event.movementKind}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={
                      event.direction === "inflow" ? "text-emerald-700" : "text-rose-700"
                    }
                  >
                    {event.direction === "inflow" ? "+" : "−"}
                    {formatEUR(event.amount)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Saldo projetado: {formatEUR(event.balanceAfter)}
                  </p>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          <h3 className="font-medium">Fontes incluídas</h3>
          <ul className="mt-2 list-disc pl-5 text-zinc-600 dark:text-zinc-400">
            {sourcesIncluded.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          <h3 className="font-medium">Excluído da projeção</h3>
          <ul className="mt-2 list-disc pl-5 text-zinc-600 dark:text-zinc-400">
            {sourcesExcluded.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
