"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const META = {
  CRITICAL: { label: "Crítica", color: "#ef4452" },
  HIGH: { label: "Alta", color: "#f97316" },
  ATTENTION: { label: "Atenção", color: "#f5ad32" },
  INFO: { label: "Informativa", color: "#2f8df7" },
} as const;

export function AlertsPriorityChart({ counts }: { counts: Record<keyof typeof META, number> }) {
  const data = (Object.keys(META) as (keyof typeof META)[]).map((severity) => ({ severity, value: counts[severity], ...META[severity] })).filter((item) => item.value > 0);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]"><h2 className="text-base font-semibold">Alertas por prioridade</h2><p className="mt-1 text-xs text-slate-500">Apenas alertas financeiros ativos.</p>{total===0?<p className="mt-6 text-sm text-slate-500">Não há alertas ativos para distribuir.</p>:<div className="mt-4 flex items-center gap-4"><div className="relative h-40 w-40 shrink-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" innerRadius={48} outerRadius={68} isAnimationActive={false}>{data.map((item)=><Cell key={item.severity} fill={item.color}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><p className="text-2xl font-semibold">{total}<span className="block text-[11px] font-normal text-slate-500">ativos</span></p></div></div><ul className="min-w-0 flex-1 space-y-2 text-xs">{data.map((item)=><li key={item.severity} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{background:item.color}}/><span className="flex-1">{item.label}</span><strong>{item.value}</strong><span className="w-11 text-right text-slate-500">{Math.round(item.value/total*100)}%</span></li>)}</ul></div>}</section>;
}
