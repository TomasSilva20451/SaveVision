"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { decimal, formatEUR } from "@/lib/finance/money";

const COLORS = ["#2563eb", "#f59e0b", "#e11d48", "#7c3aed", "#10b981", "#0891b2"];

type MonthPoint = { label: string; expected: number; paid: number };
type Slice = { name: string; value: string };

export function RecurringCharts({
  months,
  slices,
  total,
}: {
  months: MonthPoint[];
  slices: Slice[];
  total: string;
}) {
  const pie = slices.map((row) => ({
    name: row.name,
    value: Number(row.value),
    share: decimal(total).isZero()
      ? 0
      : decimal(row.value).div(total).times(100).toDecimalPlaces(1).toNumber(),
  }));
  const hasEvolution = months.some((month) => month.expected !== 0 || month.paid !== 0);

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-5">
      <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] lg:col-span-3">
        <h2 className="text-base font-semibold">Evolução das despesas recorrentes</h2>
        <p className="mt-1 text-sm text-slate-500">
          Últimos 6 meses registados: valor previsto e valor efetivamente pago.
        </p>
        {!hasEvolution ? (
          <p className="mt-6 text-sm text-slate-600">Ainda não há ocorrências para desenhar a evolução.</p>
        ) : (
          <div className="mt-4 h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months}>
                <CartesianGrid stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={48} />
                <Tooltip formatter={(value) => formatEUR(String(value ?? 0))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="expected" name="Previsto" fill="#2563eb" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="paid" name="Pago" fill="#f59e0b" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
      <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] lg:col-span-2">
        <h2 className="text-base font-semibold">Despesas recorrentes por categoria</h2>
        <p className="mt-1 text-sm text-slate-500">Equivalente mensal das recorrências ativas.</p>
        {pie.length === 0 ? (
          <p className="mt-6 text-sm text-slate-600">Sem recorrências ativas para distribuir.</p>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
            <div className="relative h-40 w-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pie}
                    dataKey="value"
                    innerRadius={48}
                    outerRadius={66}
                    paddingAngle={2}
                    isAnimationActive
                    animationBegin={80}
                    animationDuration={900}
                    animationEasing="ease-out"
                  >
                    {pie.map((slice, index) => (
                      <Cell key={slice.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatEUR(String(value ?? 0))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center px-4 text-center">
                <p className="text-xs font-semibold tabular-nums">
                  {formatEUR(total)}
                  <span className="mt-0.5 block font-normal text-slate-500">por mês</span>
                </p>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-2 text-sm">
              {pie.map((slice, index) => (
                <li key={slice.name} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
                  <span className="min-w-0 flex-1 truncate">{slice.name}</span>
                  <span className="shrink-0 tabular-nums text-slate-600">
                    {formatEUR(String(slice.value))} · {slice.share}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
