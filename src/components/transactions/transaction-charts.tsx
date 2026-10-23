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

const COLORS = ["#2563eb", "#059669", "#d97706", "#e11d48", "#7c3aed", "#0891b2"];

type DailyPoint = { date: string; income: number; expense: number };
type CategorySlice = { name: string; value: string };

export function TransactionCharts({
  daily,
  categories,
  expenseTotal,
}: {
  daily: DailyPoint[];
  categories: CategorySlice[];
  expenseTotal: string;
}) {
  const slices = categories.map((row) => ({
    name: row.name,
    value: Number(row.value),
    share: decimal(expenseTotal).isZero()
      ? 0
      : decimal(row.value).div(expenseTotal).times(100).toDecimalPlaces(1).toNumber(),
  }));

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-5">
      <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] lg:col-span-3">
        <h2 className="text-base font-semibold">Entradas e saídas</h2>
        <p className="mt-1 text-sm text-slate-500">Evolução dos movimentos no período filtrado.</p>
        {daily.length === 0 ? (
          <p className="mt-8 text-sm text-slate-600">Sem receitas ou despesas concluídas neste período.</p>
        ) : (
          <div className="mt-4 h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily}>
                <CartesianGrid stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={48} />
                <Tooltip formatter={(value) => formatEUR(String(value ?? 0))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" name="Entradas" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Saídas" fill="#e11d48" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] lg:col-span-2">
        <h2 className="text-base font-semibold">Despesas por categoria</h2>
        <p className="mt-1 text-sm text-slate-500">Apenas despesas económicas concluídas.</p>
        {slices.length === 0 ? (
          <p className="mt-8 text-sm text-slate-600">Sem despesas neste período.</p>
        ) : (
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
                <p className="text-sm font-semibold tabular-nums">
                  {formatEUR(expenseTotal)}
                  <span className="mt-0.5 block text-[10px] font-normal text-slate-500">despesas</span>
                </p>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-2 text-sm">
              {slices.map((slice, index) => (
                <li key={slice.name} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
                  <span className="min-w-0 flex-1 truncate">{slice.name}</span>
                  <span className="shrink-0 text-right tabular-nums">
                    {formatEUR(String(slice.value))}
                    <span className="block text-xs text-slate-500">{slice.share}%</span>
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
