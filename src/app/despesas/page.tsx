import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ExpenseDashboard } from "@/components/expenses/expense-dashboard";
import { EmptyState } from "@/components/ui/empty-state";
import { FinanceMetricCard, MetricGrid } from "@/components/ui/finance-metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { primaryButtonClassName } from "@/components/ui/form-styles";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { civilDateFromInstant, formatCivilDateIso } from "@/lib/datetime/civil-date";
import { decimal, formatEUR } from "@/lib/finance/money";
import { readPageFlash } from "@/lib/ui/page-shell";
import { listAccountsWithBalances } from "@/server/services/accounts";
import { getDashboardMetrics } from "@/server/services/dashboard";
import { getExpenseAnalysis } from "@/server/services/expense-analysis";
import { listExpenses } from "@/server/services/expenses";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

const MONTHS=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

async function DespesasContent(){
  await ensureRequestDynamic(); const flash=await readPageFlash(); const user=await requireAuthenticatedUser(); if(!user)redirect("/login");
  const {workspaces,selected}=await resolveWorkspaceContext(user.id); if(!selected)redirect("/inicio");
  const membership=await requireWorkspaceAccess(user.id,selected.id); if(!membership)redirect("/inicio");
  const civil=civilDateFromInstant(new Date());
  const [accounts,data,analysis,dashboard]=await Promise.all([listAccountsWithBalances(user.id,selected.id),listExpenses(user.id,selected.id),getExpenseAnalysis(user.id,selected.id,civil.year,civil.month),getDashboardMetrics(user.id,selected.id)]);
  const safeAccounts=accounts??[]; const rows=data?.transactions??[]; const monthDays=Math.max(1,civil.day); const averageDaily=analysis?decimal(analysis.totalMonth).div(monthDays).toFixed(2):"0";
  const budgetLimit=dashboard?.kpis.budgetLimitMonth??"0"; const budgetSpent=dashboard?.kpis.budgetSpentMonth??"0"; const utilization=decimal(budgetLimit).gt(0)?decimal(budgetSpent).div(budgetLimit).times(100).toDecimalPlaces(0).toNumber():null;
  return <AppShell visualTheme="aurora" userName={user.name} workspaces={workspaces} activeWorkspaceId={selected.id} flash={flash}>
    <PageHeader title="Despesas" description="Acompanha onde gastas, compara com o orçamento e regista movimentos concluídos." actions={<Link href="/orcamentos" className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium">Ver orçamentos</Link>}/>
    <div className="mt-6"><MetricGrid><FinanceMetricCard label="Despesas este mês" value={analysis?.totalMonth??"0"} hint={analysis?.monthChangePercent==null?"Sem comparação anterior":`${analysis.monthChangePercent>=0?"↑":"↓"} ${Math.abs(analysis.monthChangePercent).toLocaleString("pt-PT")}% vs. mês anterior`} tone="expense" icon="↘"/><FinanceMetricCard label="Média diária" value={averageDaily} hint={`Com base nos primeiros ${monthDays} dias`} tone="accent" icon="◷"/><FinanceMetricCard label="Média mensal (6 meses)" value={analysis?.averageMonthly??"0"} hint={analysis?.hasEnoughHistory?"Histórico real disponível":"Ainda com pouco histórico"} tone="analytic" icon="▥"/><FinanceMetricCard label="Orçamento utilizado" value={utilization==null?"N/D":`${utilization}%`} rawValue hint={decimal(budgetLimit).gt(0)?`${formatEUR(budgetSpent)} de ${formatEUR(budgetLimit)}`:"Define limites mensais"} tone={utilization!=null&&utilization>100?"expense":"income"} icon="◎"/></MetricGrid></div>
    {safeAccounts.length===0?<div className="mt-5"><EmptyState title="Cria primeiro uma conta" description="Uma despesa precisa de uma conta de origem." action={<Link href="/contas" className={primaryButtonClassName}>Ir para contas</Link>}/></div>:<div className="mt-5"><ExpenseDashboard accounts={safeAccounts.map(a=>({id:a.id,name:a.name}))} categories={(data?.categories??[]).map(c=>({id:c.id,name:c.name}))} transactions={rows.map(tx=>({id:tx.id,accountName:tx.account.name,categoryName:tx.category?.name??"Sem categoria",description:tx.description??"Sem descrição",amount:tx.amount.toString(),occurredAt:tx.occurredAt.toISOString()}))} monthly={(analysis?.monthlyTotals??[]).map(row=>({label:`${MONTHS[row.month-1]} ${String(row.year).slice(-2)}`,value:Number(row.total)}))} byCategory={(analysis?.byCategory??[]).map(row=>({name:row.name,value:Number(row.total)}))} today={formatCivilDateIso(civil)}/></div>}
  </AppShell>;
}
export default function DespesasPage(){return <Suspense fallback={<p className="p-6 text-sm">A carregar despesas…</p>}><DespesasContent/></Suspense>}
