"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { decimal, formatEUR } from "@/lib/finance/money";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { civilDateFromInstant, formatCivilDate } from "@/lib/datetime/civil-date";
import type { FinancialAlertView } from "@/server/services/financial-alerts";

const PIE_COLORS = ["#2563eb", "#059669", "#d97706", "#7c3aed", "#64748b"];

type CategoryRow = { name: string; value: number };
type BalancePoint = { label: string; balance: number };
type TreasuryBar = { label: string; projectedBalance: number };
type AccountRow = {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  balance: string;
};
type BudgetCategory = { name: string; spent: string; limit: string; percent: number };
type RecurringRow = { name: string; dueDate: string; amount: string; status: string };

type DashboardGridProps = {
  incomeMonth: string;
  expenseMonth: string;
  incomeByCategory: CategoryRow[];
  expenseByCategory: CategoryRow[];
  balanceSeries: BalancePoint[];
  realBalance: string;
  treasuryBars: TreasuryBar[];
  budgetUtilization: number | null;
  budgetCategories: BudgetCategory[];
  budgetSummary: { totalLimit: string; totalSpent: string; totalAvailable: string };
  topAccounts: AccountRow[];
  upcomingRecurring: RecurringRow[];
  patrimony: {
    accountsEngine: string;
    investments: string;
    liabilities: string;
    netPatrimony: string;
  };
  alerts: FinancialAlertView[];
};

function WidgetShell({
  title,
  href,
  children,
  className = "",
  testId,
}: {
  title: string;
  href: string;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section
      className={`flex min-w-0 flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] sm:p-5 ${className}`}
      data-testid={testId}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
        <Link href={href} className="text-xs font-medium text-blue-600 hover:underline">
          Ver todos →
        </Link>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}

function formatMoneyDisplay(value: string, signedNegative = false) {
  if (decimal(value).isZero()) return formatEUR(0);
  if (signedNegative) return `− ${formatEUR(value)}`;
  return formatEUR(value);
}

function MoneyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-slate-700">{label}</p>
      {payload
        .filter((item) => item.value != null)
        .map((item) => (
          <p key={item.name} className="tabular-nums text-slate-600">
            <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: item.color }} />
            {item.name}: {formatEUR(String(item.value))}
          </p>
        ))}
    </div>
  );
}

function formatAxisEur(value: number) {
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(0)}k €`;
  }
  return `${value} €`;
}

function FluxColumn({
  title,
  total,
  categories,
  tone,
}: {
  title: string;
  total: string;
  categories: CategoryRow[];
  tone: "income" | "expense";
}) {
  const max = categories[0]?.value ?? 1;
  return (
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums ${tone === "income" ? "text-emerald-700" : "text-rose-700"}`}
      >
        {formatEUR(total)}
      </p>
      <ul className="mt-4 space-y-3">
        {categories.length === 0 ? (
          <li className="text-xs text-slate-500">Sem movimentos neste mês.</li>
        ) : (
          categories.slice(0, 4).map((row) => (
            <li key={row.name}>
              <div className="mb-1 flex justify-between gap-2 text-xs">
                <span className="truncate text-slate-600">{row.name}</span>
                <span className="shrink-0 tabular-nums text-slate-800">{formatEUR(String(row.value))}</span>
              </div>
              <ProgressBar
                value={row.value}
                max={max}
                tone={tone === "income" ? "income" : "expense"}
              />
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

const severityVariant: Record<
  FinancialAlertView["severity"],
  "danger" | "warning" | "info" | "muted"
> = {
  CRITICAL: "danger",
  HIGH: "warning",
  ATTENTION: "warning",
  INFO: "info",
};

export function DashboardGrid(props: DashboardGridProps) {
  const balanceChart = [
    ...props.balanceSeries.map((point) => ({
      label: point.label,
      balance: point.balance,
      projected: null as number | null,
    })),
    {
      label: "Hoje",
      balance: Number(props.realBalance),
      projected: Number(props.realBalance),
    },
    ...props.treasuryBars.slice(0, 4).map((row) => ({
      label: row.label,
      balance: null as number | null,
      projected: row.projectedBalance,
    })),
  ];

  const hasBudget =
    props.budgetUtilization != null && decimal(props.budgetSummary.totalLimit).gt(0);
  const pieData = hasBudget
    ? props.budgetCategories.map((c) => ({ name: c.name, value: Math.max(c.percent, 0) }))
    : [];

  const alertItems = props.alerts.filter((a) => !a.dismissedAt).slice(0, 4);

  return (
    <div className="mt-6 space-y-5">
      <div className="grid min-w-0 gap-5 lg:grid-cols-5">
        <WidgetShell title="Evolução do saldo" href="/previsoes" className="lg:col-span-3">
          <div className="h-64 w-full min-w-0">
            {props.balanceSeries.every((p) => p.balance === props.balanceSeries[0]?.balance) &&
            props.balanceSeries.length < 2 ? (
              <p className="text-sm text-slate-500">
                Histórico insuficiente para curva — a mostrar saldo actual e projeções de tesouraria.
              </p>
            ) : null}
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={balanceChart}>
                <CartesianGrid stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={formatAxisEur}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  width={48}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<MoneyTooltip />} />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="balance"
                  name="Histórico"
                  stroke="#2563eb"
                  fill="#2563eb"
                  fillOpacity={0.1}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#2563eb", strokeWidth: 0 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="projected"
                  name="Projeção"
                  stroke="#93c5fd"
                  strokeDasharray="5 4"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#93c5fd", strokeWidth: 0 }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </WidgetShell>

        <WidgetShell title="Fluxos deste mês" href="/transacoes" className="lg:col-span-2">
          <div className="flex flex-col gap-6 sm:flex-row">
            <FluxColumn
              title="Receitas"
              total={props.incomeMonth}
              categories={props.incomeByCategory}
              tone="income"
            />
            <FluxColumn
              title="Despesas"
              total={props.expenseMonth}
              categories={props.expenseByCategory}
              tone="expense"
            />
          </div>
        </WidgetShell>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-3">
        <WidgetShell title="Orçamentos" href="/orcamentos">
          {!hasBudget ? (
            <div className="flex h-full flex-col items-start justify-center gap-3 py-4">
              <p className="text-sm text-slate-600">Ainda não definiste orçamentos.</p>
              <Link href="/orcamentos" className="text-sm font-medium text-blue-600 hover:underline">
                Criar orçamento
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <div className="relative h-36 w-36 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} innerRadius={42} outerRadius={58} paddingAngle={2} dataKey="value">
                      {pieData.map((_, index) => (
                        <Cell key={pieData[index]?.name ?? index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <p className="text-center text-sm font-semibold text-slate-800">
                    {props.budgetUtilization}%
                    <span className="block text-[10px] font-normal text-slate-500">utilizado</span>
                  </p>
                </div>
              </div>
              <ul className="min-w-0 flex-1 space-y-2 text-sm">
                <li className="flex justify-between gap-2">
                  <span className="text-slate-500">Orçamentado</span>
                  <span className="font-medium tabular-nums">{formatEUR(props.budgetSummary.totalLimit)}</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-slate-500">Utilizado</span>
                  <span className="font-medium tabular-nums">{formatEUR(props.budgetSummary.totalSpent)}</span>
                </li>
                {props.budgetCategories.slice(0, 4).map((line, i) => (
                  <li key={line.name} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      aria-hidden
                    />
                    <span className="truncate text-slate-600">{line.name}</span>
                    <span className="ml-auto tabular-nums text-slate-800">{line.percent}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </WidgetShell>

        <WidgetShell title="Previsão de tesouraria" href="/previsoes">
          <p className="mb-2 text-xs text-slate-500">
            Saldo real: <span className="font-medium text-slate-800">{formatEUR(props.realBalance)}</span>
          </p>
          <div className="h-40 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={props.treasuryBars} margin={{ top: 18, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={formatAxisEur}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  width={44}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<MoneyTooltip />} />
                <Bar dataKey="projectedBalance" name="Saldo projetado" radius={[6, 6, 0, 0]}>
                  {props.treasuryBars.map((_, index) => (
                    <Cell key={props.treasuryBars[index]?.label ?? index} fill={["#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8"][index % 6]} />
                  ))}
                  <LabelList
                    dataKey="projectedBalance"
                    position="top"
                    formatter={(value) => formatAxisEur(Number(value))}
                    style={{ fontSize: 9, fill: "#64748b" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </WidgetShell>

        <WidgetShell title="Alertas ativos" href="/alertas" testId="dashboard-alerts-section">
          {alertItems.length === 0 ? (
            <div className="flex items-start gap-3 py-1 text-sm text-slate-600">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500" aria-hidden>
                ✓
              </span>
              <p>Sem alertas activos. O FinTwin avisa quando detetar riscos.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {alertItems.map((alert) => (
                <li key={alert.id} className="flex gap-3 text-sm">
                  <StatusBadge variant={severityVariant[alert.severity]}>
                    {alert.severity === "CRITICAL" ? "!" : "•"}
                  </StatusBadge>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800">{alert.title}</p>
                    <p className="line-clamp-2 text-xs text-slate-500">{alert.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </WidgetShell>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-3">
        <WidgetShell title="Principais contas" href="/contas">
          <ul className="divide-y divide-[var(--border)] text-sm">
            {props.topAccounts.length === 0 ? (
              <li className="py-2 text-slate-500">Sem contas registadas.</li>
            ) : (
              props.topAccounts.map((account) => (
                <li key={account.id}>
                  <Link
                    href={`/contas/${account.id}`}
                    className="flex items-center gap-3 py-2.5 hover:bg-slate-50/80"
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm ${
                        account.type === "SAVINGS"
                          ? "bg-violet-100 text-violet-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                      aria-hidden
                    >
                      {account.type === "SAVINGS" ? "🐷" : "🏦"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-800">{account.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {account.institution ?? account.type}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                      {formatEUR(account.balance)}
                    </span>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </WidgetShell>

        <WidgetShell title="Despesas recorrentes" href="/despesas-recorrentes">
          <ul className="divide-y divide-[var(--border)] text-sm">
            {props.upcomingRecurring.length === 0 ? (
              <li className="py-2">
                <p className="text-sm text-slate-600">Sem vencimentos futuros.</p>
                <Link href="/despesas-recorrentes" className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline">
                  Criar recorrência
                </Link>
              </li>
            ) : (
              props.upcomingRecurring.map((row) => (
                <li key={`${row.name}-${row.dueDate}`} className="flex items-center gap-3 py-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700" aria-hidden>
                    ↻
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800">{row.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatCivilDate(civilDateFromInstant(new Date(row.dueDate)))} · {row.status}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums font-medium text-slate-800">
                    {formatEUR(row.amount)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </WidgetShell>

        <WidgetShell title="Património e passivos" href="/patrimonio">
          <ul className="space-y-1 text-sm">
            {[
              {
                label: "Contas",
                value: formatMoneyDisplay(props.patrimony.accountsEngine),
                icon: "🏦",
                tone: "bg-emerald-100 text-emerald-700",
              },
              {
                label: "Investimentos",
                value: formatMoneyDisplay(props.patrimony.investments),
                icon: "📈",
                tone: "bg-violet-100 text-violet-700",
              },
              {
                label: "Passivos",
                value: formatMoneyDisplay(props.patrimony.liabilities, true),
                icon: "⚠",
                tone: "bg-rose-100 text-rose-700",
                negative: !decimal(props.patrimony.liabilities).isZero(),
              },
            ].map((row) => (
              <li key={row.label} className="flex items-center gap-3 border-b border-[var(--border)] py-2 last:border-0">
                <span className={`grid h-8 w-8 place-items-center rounded-lg text-sm ${row.tone}`} aria-hidden>
                  {row.icon}
                </span>
                <span className="flex-1 text-slate-600">{row.label}</span>
                <span
                  className={`font-medium tabular-nums ${"negative" in row && row.negative ? "text-rose-700" : "text-slate-900"}`}
                >
                  {row.value}
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-2 pt-2">
              <span className="font-medium text-slate-700">Património líquido</span>
              <span className="text-base font-semibold tabular-nums text-blue-700">
                {formatEUR(props.patrimony.netPatrimony)}
              </span>
            </li>
          </ul>
        </WidgetShell>
      </div>
    </div>
  );
}
