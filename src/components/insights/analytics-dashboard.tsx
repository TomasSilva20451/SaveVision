"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
import { InsightExplainButton } from "@/components/insights/insight-explain-button";
import type { FinancialInsightsOverview } from "@/server/services/financial-insights";
import { formatEUR } from "@/lib/finance/money";
import type { MetricTone } from "@/components/ui/finance-metric-card";

type Analytics = FinancialInsightsOverview["analytics"];
type Insight = FinancialInsightsOverview["insights"][number];
type TabId = "overview" | "expenses" | "income" | "savings" | "patrimony" | "comparisons" | "trends";
type IconKind = "saving" | "daily" | "essential" | "budget" | "income" | "expense" | "cash" | "insight" | "asset";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Visão geral" },
  { id: "expenses", label: "Despesas" },
  { id: "income", label: "Receitas" },
  { id: "savings", label: "Poupança e investimentos" },
  { id: "patrimony", label: "Património" },
  { id: "comparisons", label: "Comparações" },
  { id: "trends", label: "Tendências" },
];

const COLORS = ["#2f8df7", "#f6b73c", "#ef5361", "#9b4ee8", "#24b99a", "#0fa77a", "#94a3b8"];

function Icon({ kind, className = "h-5 w-5" }: { kind: IconKind; className?: string }) {
  const paths: Record<IconKind, ReactNode> = {
    saving: <><path d="m4 16 5-5 4 4 7-8"/><path d="M15 7h5v5"/></>,
    daily: <><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></>,
    essential: <><circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/></>,
    budget: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="m14.5 9.5 5-5M16 4.5h3.5V8"/></>,
    income: <><path d="M12 20V5m0 0-5 5m5-5 5 5"/></>,
    expense: <><path d="M12 4v15m0 0-5-5m5 5 5-5"/></>,
    cash: <><path d="M4 20V10m6 10V4m6 16v-7m4 7H2"/></>,
    insight: <><path d="M9 18h6M10 22h4M8 14c-1.3-1-2-2.7-2-4.5a6 6 0 1 1 12 0c0 1.8-.7 3.5-2 4.5-.8.7-1 1.2-1 2H9c0-.8-.2-1.3-1-2Z"/></>,
    asset: <><path d="M3 10 12 3l9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>{paths[kind]}</svg>;
}

function Card({ children, className = "", testId }: { children: ReactNode; className?: string; testId?: string }) {
  return <section data-testid={testId} className={`min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] ${className}`}>{children}</section>;
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h2 className="text-base font-semibold">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div>;
}

const kpiIconTone: Record<MetricTone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  income: "bg-emerald-100 text-emerald-700",
  expense: "bg-rose-100 text-rose-700",
  warning: "bg-amber-100 text-amber-800",
  analytic: "bg-violet-100 text-violet-700",
  accent: "bg-blue-100 text-blue-700",
};

function KpiCard({ label, value, hint, icon, tone, chart }: { label: string; value: string; hint: string; icon: IconKind; tone: MetricTone; chart?: ReactNode }) {
  return <section data-tone={tone} className="finance-metric-card min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]"><div className="flex min-h-20 items-center gap-3"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${kpiIconTone[tone]}`}><Icon kind={icon}/></span><div className="min-w-0 flex-1"><p className="text-sm text-slate-500">{label}</p><p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-slate-50">{value}</p><p className="mt-1 text-xs text-slate-500">{hint}</p></div>{chart ? <div className="hidden h-12 w-20 shrink-0 2xl:block">{chart}</div> : null}</div></section>;
}

export function AnalyticsDashboard({ analytics, insights }: { analytics: Analytics; insights: Insight[] }) {
  const [tab, setTab] = useState<TabId>("overview");
  const latestSaving = [...analytics.monthly].reverse().find((row) => row.savingsRate != null)?.savingsRate ?? null;
  const monthlyChart = analytics.monthly.map((row) => ({ ...row, incomeNumber: Number(row.income), expenseNumber: Number(row.expense), cashNumber: Number(row.cumulativeCashMovement) }));
  const categoryChart = analytics.categories.map((row) => ({ ...row, amountNumber: Number(row.amount) }));

  return <div data-testid="financial-insights-page" className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Taxa de poupança" value={analytics.savingsRate == null ? "N/D" : `${analytics.savingsRate.toFixed(1)}%`} hint={analytics.savingsRateChangePoints == null ? "Sem período anterior comparável" : `${analytics.savingsRateChangePoints >= 0 ? "+" : ""}${analytics.savingsRateChangePoints.toFixed(1)} p.p. vs período anterior`} icon="saving" tone="income" chart={<Sparkline data={analytics.monthly.map((row) => row.savingsRate)} color="#0fa77a"/>}/>
      <KpiCard label="Despesa média diária" value={formatEUR(analytics.averageDailyExpense)} hint={`${analytics.observedDays} dias civis observados`} icon="daily" tone="accent" chart={<Sparkline data={analytics.monthly.map((row) => Number(row.expense))} color="#2f8df7"/>}/>
      <KpiCard label="Rácio de essencialidade" value={analytics.essentialityRatio == null ? "N/D" : `${analytics.essentialityRatio.toFixed(1)}%`} hint="Categorias marcadas como necessárias" icon="essential" tone="analytic"/>
      <KpiCard label="Cumprimento dos orçamentos" value={analytics.budgetCompliancePercent == null ? "N/D" : `${analytics.budgetCompliancePercent.toFixed(1)}%`} hint={analytics.budgets.length ? "Categorias dentro do limite mensal" : "Sem orçamento no mês atual"} icon="budget" tone="expense"/>
    </div>

    <div className="aurora-tabs flex max-w-full items-center justify-between gap-3 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2" role="tablist" aria-label="Perspetivas de análise">
      <div className="flex min-w-max">{TABS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`border-b-2 px-4 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${tab === item.id ? "aurora-tab-active border-blue-600 text-blue-700" : "border-transparent text-slate-600 hover:text-slate-900"}`}>{item.label}</button>)}</div>
      <span className="hidden shrink-0 pr-3 text-xs text-slate-500 lg:block">{analytics.periodLabel}</span>
    </div>

    {(["overview", "expenses", "income", "comparisons"] as TabId[]).includes(tab) ? <div className="grid min-w-0 gap-4 xl:grid-cols-3">
      <Card testId="analytics-income-expense-chart"><SectionTitle title="Evolução de receitas e despesas" subtitle="Movimentos económicos realizados por mês."/><MonthlyBars data={monthlyChart}/></Card>
      {tab === "overview" || tab === "expenses" ? <Card testId="analytics-expense-distribution"><SectionTitle title="Distribuição das despesas" subtitle="Categorias reais no período selecionado."/><ExpenseDonut data={categoryChart} total={analytics.expense}/></Card> : null}
      {tab === "income" ? <Card><SectionTitle title="Receitas por origem" subtitle="Apenas entradas realizadas."/><Origins rows={analytics.incomeOrigins} tone="income"/></Card> : null}
      <Card testId="analytics-savings-chart"><SectionTitle title="Evolução da taxa de poupança" subtitle="Resultado económico sobre receitas realizadas."/><SavingsTrend data={analytics.monthly} latest={latestSaving}/></Card>
    </div> : null}

    {(["overview", "expenses", "comparisons"] as TabId[]).includes(tab) ? <div className="grid min-w-0 gap-4 lg:grid-cols-3">
      <Card testId="analytics-categories"><SectionTitle title="Principais categorias de despesa" subtitle="Ordenadas por montante; variação vs período anterior."/><CategoryList rows={analytics.categories}/></Card>
      <Card testId="analytics-budgets"><SectionTitle title="Análise de orçamentos" subtitle="Limites do mês atual vs despesa realizada."/><BudgetTable rows={analytics.budgets}/></Card>
      <Card testId="analytics-cashflow"><SectionTitle title="Movimento de caixa acumulado" subtitle="Entradas, saídas e ajustamentos; transferências internas excluídas."/><CashFlowChart data={monthlyChart}/></Card>
    </div> : null}

    {(tab === "income" || tab === "expenses") ? <div className="grid min-w-0 gap-4 lg:grid-cols-3">
      <Card><SectionTitle title="Receitas por origem" subtitle="Taxonomia de receitas separada das despesas."/><Origins rows={analytics.incomeOrigins} tone="income"/></Card>
      <Card><SectionTitle title="Despesas por categoria" subtitle="Sem emparelhar taxonomias distintas."/><Origins rows={analytics.categories.map((row) => ({ name: row.name, amount: row.amount }))} tone="expense"/></Card>
      <Card testId="analytics-homologous"><SectionTitle title="Comparação homóloga" subtitle="Mesmo intervalo do ano anterior, quando disponível."/><Homologous analytics={analytics}/></Card>
    </div> : null}

    {tab === "trends" ? <div className="grid min-w-0 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2" testId="analytics-insights"><SectionTitle title="Insights e recomendações" subtitle="Regras determinísticas e evidência explicável."/><InsightList insights={insights}/></Card>
      <Card testId="analytics-homologous"><SectionTitle title="Comparação com período homólogo" subtitle="Sem histórico artificial."/><Homologous analytics={analytics}/></Card>
    </div> : null}

    {tab === "savings" ? <div className="grid gap-4 lg:grid-cols-3"><Card className="lg:col-span-2"><SectionTitle title="Poupança económica" subtitle="Receitas realizadas menos despesas económicas."/><SavingsTrend data={analytics.monthly} latest={latestSaving}/></Card><Card><SectionTitle title="Investimentos conhecidos" subtitle="Valores manuais atuais, sem rentabilidade histórica inventada."/><p className="mt-5 text-3xl font-semibold">{formatEUR(analytics.investments.currentStandaloneValue)}</p><p className="mt-2 text-sm text-slate-500">{analytics.investments.positionCount} posições registadas.</p><Link href="/investimentos" className="mt-5 inline-block text-sm font-medium text-blue-600">Ver investimentos →</Link></Card></div> : null}

    {tab === "patrimony" ? <Card testId="analytics-patrimony"><SectionTitle title="Evolução do património líquido" subtitle="Exclusivamente snapshots persistidos."/><PatrimonyChart rows={analytics.patrimonySnapshots}/></Card> : null}

    {tab === "overview" ? <div className="grid min-w-0 gap-4 lg:grid-cols-3">
      <Card><SectionTitle title="Receitas e despesas por origem/categoria" subtitle="Taxonomias apresentadas separadamente."/><div className="mt-4 grid gap-4"><Origins rows={analytics.incomeOrigins.slice(0, 3)} tone="income"/><Origins rows={analytics.categories.slice(0, 4).map((row) => ({ name: row.name, amount: row.amount }))} tone="expense"/></div></Card>
      <Card testId="analytics-insights"><SectionTitle title="Insights e recomendações" subtitle="Regras determinísticas com evidência."/><InsightList insights={insights.slice(0, 3)}/></Card>
      <Card testId="analytics-homologous"><SectionTitle title="Comparação com período homólogo" subtitle="Mesmo intervalo do ano anterior."/><Homologous analytics={analytics}/></Card>
    </div> : null}
  </div>;
}

function Sparkline({ data, color }: { data: Array<number | null>; color: string }) {
  const values = data.filter((value): value is number => value != null);
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => `${index / (values.length - 1) * 80},${44 - (value - min) / range * 38}`).join(" ");
  return <svg viewBox="0 0 80 48" role="img" aria-label="Tendência no período" className="h-full w-full"><polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function MonthlyBars({ data }: { data: Array<{ label: string; incomeNumber: number; expenseNumber: number }> }) {
  if (!data.some((row) => row.incomeNumber !== 0 || row.expenseNumber !== 0)) return <Empty text="Sem receitas ou despesas realizadas neste período."/>;
  return <div className="mt-4 h-56" role="img" aria-label="Receitas e despesas mensais"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid stroke="#e8eef6" vertical={false}/><XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis tick={{ fontSize: 10 }} width={55} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => formatEUR(String(value ?? 0))}/><Legend wrapperStyle={{ fontSize: 11 }}/><Bar dataKey="incomeNumber" name="Receitas" fill="#2f8df7" radius={[4, 4, 0, 0]} isAnimationActive={false}/><Bar dataKey="expenseNumber" name="Despesas" fill="#ef5361" radius={[4, 4, 0, 0]} isAnimationActive={false}/></BarChart></ResponsiveContainer></div>;
}

function ExpenseDonut({ data, total }: { data: Array<{ id: string; name: string; amountNumber: number; amount: string }>; total: string }) {
  if (!data.length) return <Empty text="Sem despesas económicas para distribuir."/>;
  return <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row xl:flex-col 2xl:flex-row"><div className="relative h-44 w-44 shrink-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="amountNumber" innerRadius={52} outerRadius={76} isAnimationActive animationBegin={80} animationDuration={900} animationEasing="ease-out">{data.map((row, index) => <Cell key={row.id} fill={COLORS[index % COLORS.length]}/>)}</Pie><Tooltip formatter={(value) => formatEUR(String(value ?? 0))}/></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><strong>{formatEUR(total)}<span className="block text-[10px] font-normal text-slate-500">total de despesas</span></strong></div></div><ul className="w-full space-y-2 text-xs">{data.slice(0, 6).map((row, index) => <li key={row.id} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[index % COLORS.length] }}/><span className="min-w-0 flex-1 truncate">{row.name}</span><strong>{formatEUR(row.amount)}</strong></li>)}</ul></div>;
}

function SavingsTrend({ data, latest }: { data: Analytics["monthly"]; latest: number | null }) {
  const rows = data.filter((row) => row.savingsRate != null);
  if (!rows.length) return <Empty text="Sem meses com receitas realizadas para calcular a taxa."/>;
  return <div className="mt-4"><p className="text-right text-sm font-semibold text-emerald-600">{latest == null ? "N/D" : `${latest.toFixed(1)}%`}</p><div className="h-52" role="img" aria-label="Taxa de poupança mensal"><ResponsiveContainer width="100%" height="100%"><AreaChart data={rows}><defs><linearGradient id="saving-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#10a779" stopOpacity={0.3}/><stop offset="1" stopColor="#10a779" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#e8eef6" vertical={false}/><XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis tickFormatter={(value) => `${value}%`} tick={{ fontSize: 10 }} width={42} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`}/><Area dataKey="savingsRate" name="Taxa de poupança" stroke="#10a779" fill="url(#saving-fill)" strokeWidth={2} connectNulls={false} isAnimationActive={false}/></AreaChart></ResponsiveContainer></div></div>;
}

function CategoryList({ rows }: { rows: Analytics["categories"] }) {
  if (!rows.length) return <Empty text="Sem categorias de despesa no período."/>;
  const max = Math.max(...rows.map((row) => Number(row.amount)), 1);
  return <ul className="mt-4 space-y-3">{rows.slice(0, 6).map((row, index) => <li key={row.id}><div className="flex items-center gap-2 text-sm"><span className="grid h-7 w-7 place-items-center rounded-lg text-xs text-white" style={{ background: COLORS[index % COLORS.length] }}>{index + 1}</span><span className="min-w-0 flex-1 truncate">{row.name}</span><strong>{formatEUR(row.amount)}</strong><span className={`w-14 text-right text-xs ${row.changePercent != null && row.changePercent > 0 ? "text-rose-600" : "text-emerald-600"}`}>{row.changePercent == null ? "N/D" : `${row.changePercent > 0 ? "+" : ""}${row.changePercent.toFixed(1)}%`}</span></div><div className="ml-9 mt-1 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${Number(row.amount) / max * 100}%`, background: COLORS[index % COLORS.length] }}/></div></li>)}</ul>;
}

function BudgetTable({ rows }: { rows: Analytics["budgets"] }) {
  if (!rows.length) return <Empty text="Sem limites orçamentais configurados para o mês atual."/>;
  return <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[430px] text-xs"><thead><tr className="border-b border-[var(--border)] text-left text-slate-500"><th className="pb-2">Categoria</th><th className="pb-2 text-right">Orçamento</th><th className="pb-2 text-right">Real</th><th className="pb-2 text-right">Estado</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{rows.map((row) => <tr key={row.categoryId}><td className="py-2 font-medium">{row.categoryName}</td><td className="py-2 text-right">{formatEUR(row.limitAmount)}</td><td className="py-2 text-right">{formatEUR(row.spentAmount)}</td><td className={`py-2 text-right font-semibold ${Number(row.difference) < 0 ? "text-rose-600" : row.utilizationPercent != null && row.utilizationPercent >= 80 ? "text-amber-600" : "text-emerald-600"}`}>{row.utilizationPercent == null ? "N/D" : `${row.utilizationPercent.toFixed(1)}%`}</td></tr>)}</tbody></table></div>;
}

function CashFlowChart({ data }: { data: Array<{ label: string; cashNumber: number }> }) {
  if (!data.some((row) => row.cashNumber !== 0)) return <Empty text="Sem movimento líquido de caixa no período."/>;
  return <div className="mt-4 h-56" role="img" aria-label="Movimento de caixa acumulado por mês"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><defs><linearGradient id="cash-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2f8df7" stopOpacity={0.35}/><stop offset="1" stopColor="#2f8df7" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#e8eef6" vertical={false}/><XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis tick={{ fontSize: 10 }} width={55} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => formatEUR(String(value ?? 0))}/><Area dataKey="cashNumber" name="Movimento acumulado" stroke="#2f8df7" fill="url(#cash-fill)" strokeWidth={2} isAnimationActive={false}/></AreaChart></ResponsiveContainer></div>;
}

function Origins({ rows, tone }: { rows: Array<{ name: string; amount: string }>; tone: "income" | "expense" }) {
  if (!rows.length) return <Empty text={tone === "income" ? "Sem receitas realizadas." : "Sem despesas realizadas."}/>;
  const max = Math.max(...rows.map((row) => Number(row.amount)), 1);
  return <ul className="space-y-2">{rows.slice(0, 6).map((row) => <li key={row.name} className="grid grid-cols-[minmax(90px,1fr)_2fr_auto] items-center gap-2 text-xs"><span className="truncate">{row.name}</span><span className="h-2 rounded-full bg-slate-100"><span className={`block h-full rounded-full ${tone === "income" ? "bg-blue-500" : "bg-rose-500"}`} style={{ width: `${Number(row.amount) / max * 100}%` }}/></span><strong className={tone === "income" ? "text-blue-700" : "text-rose-600"}>{formatEUR(row.amount)}</strong></li>)}</ul>;
}

function InsightList({ insights }: { insights: Insight[] }) {
  if (!insights.length) return <Empty text="Ainda não existem dados suficientes para gerar insights."/>;
  const tone: Record<Insight["severity"], string> = { INFORMATION: "bg-blue-50 text-blue-600", POSITIVE: "bg-emerald-50 text-emerald-600", ATTENTION: "bg-amber-50 text-amber-600", WARNING: "bg-rose-50 text-rose-600" };
  return <ul className="mt-4 space-y-2">{insights.slice(0, 5).map((insight) => <li key={insight.id} className="flex gap-3 rounded-xl border border-[var(--border)] p-3" data-testid="financial-insight-item"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tone[insight.severity]}`}><Icon kind="insight" className="h-4 w-4"/></span><div className="min-w-0"><p className="text-sm font-semibold">{insight.title}</p><p className="mt-0.5 text-xs leading-5 text-slate-500">{insight.description}</p>{insight.evidence[0] ? <p className="mt-1 text-[11px] text-slate-400">Evidência: {insight.evidence[0]}</p> : null}{insight.linkHref ? <Link href={insight.linkHref} className="mt-1 inline-block text-xs font-medium text-blue-600">Ver detalhe →</Link> : null}<InsightExplainButton insightId={insight.id}/></div></li>)}</ul>;
}

function Homologous({ analytics }: { analytics: Analytics }) {
  if (!analytics.comparison.homologous.available) return <Empty text="Sem movimentos realizados no período homólogo."/>;
  const rows = [
    { label: "Receitas", current: analytics.income, previous: analytics.comparison.homologous.income, icon: "income" as const },
    { label: "Despesas", current: analytics.expense, previous: analytics.comparison.homologous.expense, icon: "expense" as const },
    { label: "Poupança", current: analytics.economicResult, previous: analytics.comparison.homologous.economicResult, icon: "saving" as const },
  ];
  return <ul className="mt-4 space-y-3">{rows.map((row) => { const previous = Number(row.previous); const change = previous === 0 ? null : (Number(row.current) - previous) / Math.abs(previous) * 100; return <li key={row.label} className="grid grid-cols-[auto_1fr_auto] items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-50 text-blue-600"><Icon kind={row.icon} className="h-4 w-4"/></span><span className="text-sm">{row.label}<span className="block text-[11px] text-slate-500">Anterior: {formatEUR(row.previous)}</span></span><span className="text-right text-sm font-semibold">{formatEUR(row.current)}<span className="block text-[11px] font-normal text-slate-500">{change == null ? "N/D" : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`}</span></span></li>; })}</ul>;
}

function PatrimonyChart({ rows }: { rows: Analytics["patrimonySnapshots"] }) {
  if (rows.length < 2) return <Empty text="São necessários pelo menos dois snapshots patrimoniais reais para mostrar a evolução."/>;
  const data = rows.map((row) => ({ label: new Intl.DateTimeFormat("pt-PT", { month: "short", year: "2-digit", timeZone: "Europe/Lisbon" }).format(new Date(row.date)).replace(".", ""), netWorth: Number(row.netWorth) }));
  return <div className="mt-4 h-72" role="img" aria-label="Evolução do património líquido por snapshots"><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid stroke="#e8eef6" vertical={false}/><XAxis dataKey="label"/><YAxis width={70}/><Tooltip formatter={(value) => formatEUR(String(value ?? 0))}/><Line dataKey="netWorth" name="Património líquido" stroke="#9b4ee8" strokeWidth={2} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>;
}

function Empty({ text }: { text: string }) {
  return <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{text}</p>;
}
