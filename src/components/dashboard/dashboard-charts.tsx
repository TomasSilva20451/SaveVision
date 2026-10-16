"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Bucket = { label: string; income: number; expense: number };
type CategoryRow = { name: string; value: number };

export function DashboardCharts({
  monthlyBuckets,
  expenseByCategory,
}: {
  monthlyBuckets: Bucket[];
  expenseByCategory: CategoryRow[];
}) {
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <figure className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <figcaption className="mb-3 text-sm font-medium">
          Receitas vs despesas por mês
        </figcaption>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyBuckets}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="income" name="Receitas" fill="#16a34a" />
              <Bar dataKey="expense" name="Despesas" fill="#dc2626" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>
      <figure className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <figcaption className="mb-3 text-sm font-medium">
          Despesas por categoria (mês atual)
        </figcaption>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={expenseByCategory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" name="EUR" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>
    </div>
  );
}
