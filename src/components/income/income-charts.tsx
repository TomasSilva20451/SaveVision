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

const COLORS = ["#2f8df7", "#27bea3", "#f5b43c", "#9b4ee8", "#94a3b8", "#f05f7c"];

type IncomeChartsProps = {
  evolution: { label: string; confirmed: number; expected: number }[];
  distribution: { name: string; value: string }[];
  total: string;
  periodLabel: string;
};

export function IncomeCharts({ evolution, distribution, total, periodLabel }: IncomeChartsProps) {
  const pie = distribution.map((item) => ({
    ...item,
    numericValue: Number(item.value),
    share: decimal(total).isZero()
      ? 0
      : decimal(item.value).div(total).times(100).toDecimalPlaces(1).toNumber(),
  }));
  const hasEvolution = evolution.some((item) => item.confirmed !== 0 || item.expected !== 0);

  return (
    <div className="income-charts grid min-w-0 gap-5 lg:grid-cols-5">
      <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] lg:col-span-3">
        <h2 className="text-base font-semibold">Evolução das receitas</h2>
        <p className="mt-1 text-sm text-slate-500">Comparação mensal entre receitas confirmadas e previstas.</p>
        {!hasEvolution ? (
          <p className="mt-8 text-sm text-slate-500">Ainda não há receitas neste intervalo.</p>
        ) : (
          <div className="mt-4 h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolution}>
                <CartesianGrid stroke="#e8eef6" vertical={false}/>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={58}/>
                <Tooltip formatter={(value) => formatEUR(String(value ?? 0))}/>
                <Legend wrapperStyle={{ fontSize: 12 }}/>
                <Bar dataKey="confirmed" name="Confirmadas" stackId="income" fill="#27bea3" radius={[4, 4, 0, 0]} isAnimationActive={false}/>
                <Bar dataKey="expected" name="Previstas" stackId="income" fill="#9b4ee8" radius={[4, 4, 0, 0]} isAnimationActive={false}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] lg:col-span-2">
        <h2 className="text-base font-semibold">
          Distribuição das receitas <span className="font-normal text-slate-500">({periodLabel})</span>
        </h2>
        {pie.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500">Sem receitas para distribuir neste mês.</p>
        ) : (
          <div className="mt-5 flex flex-col items-center gap-5 2xl:flex-row">
            <div className="relative h-44 w-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pie}
                    dataKey="numericValue"
                    innerRadius={52}
                    outerRadius={76}
                    paddingAngle={1}
                    isAnimationActive
                    animationBegin={80}
                    animationDuration={900}
                    animationEasing="ease-out"
                  >
                    {pie.map((slice, index) => (
                      <Cell key={slice.name} fill={COLORS[index % COLORS.length]}/>
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatEUR(String(value ?? 0))}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <p className="text-lg font-semibold tabular-nums">
                  {formatEUR(total)}
                  <span className="block text-[11px] font-normal text-slate-500">total de receitas</span>
                </p>
              </div>
            </div>
            <ul className="w-full min-w-0 flex-1 space-y-2.5 text-xs">
              {pie.map((slice, index) => (
                <li key={slice.name} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}/>
                  <span className="min-w-0 truncate">{slice.name}</span>
                  <span className="whitespace-nowrap font-semibold tabular-nums">{formatEUR(slice.value)}</span>
                  <span className="w-10 text-right text-slate-500">{slice.share}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
