"use client";

import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { decimal, formatEUR } from "@/lib/finance/money";

const COLORS = ["#2563eb", "#059669", "#7c3aed", "#d97706", "#e11d48", "#0891b2"];

type Series = { id: string; name: string; points: { label: string; balance: number }[] };
type AccountSlice = { id: string; name: string; currentBalance: string };

export function AccountsCharts({
  series,
  accounts,
  total,
  hasMovementHistory,
}: {
  series: Series[];
  accounts: AccountSlice[];
  total: string;
  hasMovementHistory: boolean;
}) {
  const chartData = series[0]?.points.map((point, index) => {
    const row: Record<string, string | number> = { label: point.label };
    for (const account of series) {
      row[account.id] = account.points[index]?.balance ?? 0;
    }
    return row;
  }) ?? [];

  const positive = accounts.filter((account) => decimal(account.currentBalance).gt(0));
  const hasNonPositive = accounts.some((account) => !decimal(account.currentBalance).gt(0));
  const positiveTotal = positive.reduce((sum, account) => sum.plus(account.currentBalance), decimal(0));
  const canDistribute = !hasNonPositive && positiveTotal.gt(0);

  const slices = canDistribute
    ? positive.map((account) => ({
        name: account.name,
        value: Number(account.currentBalance),
        share: decimal(account.currentBalance).div(positiveTotal).times(100).toDecimalPlaces(1).toNumber(),
      }))
    : [];

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-5">
      <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] lg:col-span-3">
        <h2 className="text-base font-semibold">Evolução do saldo por conta</h2>
        <p className="mt-1 text-sm text-slate-500">
          Reconstruída a partir do saldo inicial e dos movimentos registados.
        </p>
        {!hasMovementHistory ? (
          <p className="mt-6 text-sm text-slate-600">
            Ainda não há movimentos. A série mostra apenas o saldo inicial, sem histórico inventado.
          </p>
        ) : null}
        <div className="mt-4 h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={48} />
              <Tooltip formatter={(value) => formatEUR(String(value ?? 0))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {series.map((account, index) => (
                <Line
                  key={account.id}
                  type="monotone"
                  dataKey={account.id}
                  name={account.name}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] lg:col-span-2">
        <h2 className="text-base font-semibold">Distribuição do saldo</h2>
        <p className="mt-1 text-sm text-slate-500">Saldo atual por conta.</p>
        {canDistribute ? (
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
            <div className="relative h-44 w-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={slices} dataKey="value" innerRadius={52} outerRadius={72} paddingAngle={2}>
                    {slices.map((slice, index) => (
                      <Cell key={slice.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center">
                <p className="text-sm font-semibold tabular-nums text-slate-900">
                  {formatEUR(total)}
                  <span className="mt-0.5 block text-[10px] font-normal text-slate-500">saldo total</span>
                </p>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-2 text-sm">
              {slices.map((slice, index) => (
                <li key={slice.name} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
                  <span className="min-w-0 flex-1 truncate text-slate-700">{slice.name}</span>
                  <span className="shrink-0 text-right tabular-nums">
                    {formatEUR(String(slice.value))}
                    <span className="block text-xs text-slate-500">{slice.share}%</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-6 text-sm text-slate-600">
            A distribuição percentual fica oculta quando há saldos negativos ou o total não é positivo.
          </p>
        )}
      </section>
    </div>
  );
}
