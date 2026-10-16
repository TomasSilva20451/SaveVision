"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type CategoryRow = { name: string; total: string };
type MonthlyRow = { year: number; month: number; total: string };
type BudgetCompareRow = { name: string; budget: number; spent: number };

function monthLabel(year: number, month: number) {
  return `${String(month).padStart(2, "0")}/${year}`;
}

export function ExpenseAnalysisCharts({
  byCategory,
  monthlyTotals,
  budgetCompare,
  hasEnoughHistory,
}: {
  byCategory: CategoryRow[];
  monthlyTotals: MonthlyRow[];
  budgetCompare: BudgetCompareRow[];
  hasEnoughHistory: boolean;
}) {
  const categoryData = byCategory.map((row) => ({
    name: row.name,
    value: Number(row.total),
  }));

  const trendData = monthlyTotals.map((row) => ({
    label: monthLabel(row.year, row.month),
    total: Number(row.total),
  }));

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <figure className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <figcaption className="mb-3 text-sm font-medium">
          Despesas por categoria (mês selecionado)
        </figcaption>
        {categoryData.length === 0 ? (
          <p className="text-sm text-zinc-500">Sem despesas neste mês.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" name="EUR" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </figure>

      <figure className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <figcaption className="mb-3 text-sm font-medium">
          Evolução mensal (últimos 6 meses)
        </figcaption>
        {!hasEnoughHistory ? (
          <p className="text-sm text-zinc-500">
            Poucos meses com dados — interpreta a tendência com cautela.
          </p>
        ) : null}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="total" name="Despesas" stroke="#dc2626" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </figure>

      <figure className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 lg:col-span-2">
        <figcaption className="mb-3 text-sm font-medium">
          Orçamento vs realizado (categorias com limite)
        </figcaption>
        {budgetCompare.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Define limites por categoria para comparar com as despesas reais.
          </p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetCompare}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="budget" name="Orçamento" fill="#16a34a" />
                <Bar dataKey="spent" name="Realizado" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </figure>
    </div>
  );
}
