"use client";

import type { ReactNode } from "react";
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

type BudgetBar = { name: string; budget: number; spent: number };
type ExpenseSlice = { name: string; value: string };

export function BudgetOverviewCharts({
  bars,
  expenses,
  expenseTotal,
  onCreate,
}: {
  bars: BudgetBar[];
  expenses: ExpenseSlice[];
  expenseTotal: string;
  onCreate?: ReactNode;
}) {
  const slices = expenses.map((row) => ({
    name: row.name,
    value: Number(row.value),
    share: decimal(expenseTotal).isZero()
      ? 0
      : decimal(row.value).div(expenseTotal).times(100).toDecimalPlaces(1).toNumber(),
  }));

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-5">
      <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] lg:col-span-3">
        <h2 className="text-base font-semibold">Resumo dos orçamentos</h2>
        <p className="mt-1 text-sm text-slate-500">Orçamento e despesa realizada por categoria com limite.</p>
        {bars.length === 0 ? (
          <div className="mt-6">
            <p className="text-sm text-slate-600">Ainda não definiste limites para este mês.</p>
            {onCreate ? <div className="mt-3">{onCreate}</div> : null}
          </div>
        ) : (
          <div className="mt-4 h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bars}>
                <CartesianGrid stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={48} />
                <Tooltip formatter={(value) => formatEUR(String(value ?? 0))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="budget" name="Orçamento" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spent" name="Gasto" fill="#e11d48" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] lg:col-span-2">
        <h2 className="text-base font-semibold">Por categoria</h2>
        <p className="mt-1 text-sm text-slate-500">Distribuição das despesas realizadas do mês.</p>
        {slices.length === 0 ? (
          <p className="mt-6 text-sm text-slate-600">Sem despesas realizadas neste mês.</p>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
            <div className="relative h-40 w-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={slices} dataKey="value" innerRadius={48} outerRadius={66} paddingAngle={2}>
                    {slices.map((slice, index) => (
                      <Cell key={slice.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center px-4 text-center">
                <p className="text-xs font-semibold tabular-nums">
                  {formatEUR(expenseTotal)}
                  <span className="mt-0.5 block font-normal text-slate-500">despesas</span>
                </p>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-2 text-sm">
              {slices.map((slice, index) => (
                <li key={slice.name} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
                  <span className="min-w-0 flex-1 truncate">{slice.name}</span>
                  <span className="shrink-0 tabular-nums">{slice.share}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
