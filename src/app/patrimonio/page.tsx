import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { NewPatrimonyDrawer } from "@/components/patrimony/new-patrimony-drawer";
import { PatrimonyOverviewCharts,PatrimonySecondaryCharts } from "@/components/patrimony/patrimony-charts";
import { PatrimonyIcon } from "@/components/patrimony/patrimony-icon";
import { AssetsTable,LiabilitiesTable } from "@/components/patrimony/patrimony-tables";
import { FinanceMetricCard,MetricGrid } from "@/components/ui/finance-metric-card";
import { filterApplyButtonClassName, primaryButtonClassName } from "@/components/ui/form-styles";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { civilDateFromInstant,formatCivilDateIso } from "@/lib/datetime/civil-date";
import { captureNetWorthSnapshotAction } from "@/lib/finance/patrimony-actions";
import { decimal,formatEUR } from "@/lib/finance/money";
import { readPageFlash } from "@/lib/ui/page-shell";
import { countUnseenFinancialAlerts } from "@/server/services/financial-alerts";
import { getPatrimonyOverview } from "@/server/services/patrimony";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

type PageProps={searchParams:Promise<{history?:string}>};
const ACCOUNT_LABEL:Record<string,string>={CURRENT:"Contas à ordem",SAVINGS:"Poupança",CASH:"Numerário",BROKERAGE:"Contas de investimento",OTHER:"Outras contas"};
function snapshotLabel(date:Date){return new Intl.DateTimeFormat("pt-PT",{month:"short",year:"2-digit",timeZone:"Europe/Lisbon"}).format(date).replace(".","");}

async function PatrimonioContent({history}:{history:string}){
  await ensureRequestDynamic();const user=await requireAuthenticatedUser();if(!user)redirect("/login");const {workspaces,selected}=await resolveWorkspaceContext(user.id);if(!selected)redirect("/inicio");if(!(await requireWorkspaceAccess(user.id,selected.id)))redirect("/inicio");
  const [data,flash,unseenAlertsCount]=await Promise.all([getPatrimonyOverview(user.id,selected.id),readPageFlash("/patrimonio"),countUnseenFinancialAlerts(user.id,selected.id)]);if(!data)redirect("/inicio");
  const assetsTotal=decimal(data.accountNetWorthFromEngine).plus(data.investmentsValue);const liabilitiesTotal=decimal(data.manualLiabilities);const debtRatio=assetsTotal.gt(0)?liabilitiesTotal.div(assetsTotal).times(100).toDecimalPlaces(1).toNumber():null;
  const distributionMap=new Map<string,ReturnType<typeof decimal>>();for(const account of data.accounts.filter((row)=>row.isIncludedInNetWorth)){const label=ACCOUNT_LABEL[account.type]??account.type;distributionMap.set(label,(distributionMap.get(label)??decimal(0)).plus(account.balance));}for(const position of data.investments.filter((row)=>row.isCountedSeparately)){const label="Investimentos autónomos";distributionMap.set(label,(distributionMap.get(label)??decimal(0)).plus(position.marketValue.toString()));}
  const distribution=[...distributionMap.entries()].map(([name,value])=>({name,value:value.toString()}));const distributionTotal=distribution.filter((row)=>decimal(row.value).gt(0)).reduce((sum,row)=>sum.plus(row.value),decimal(0)).toString();
  const limit=history==="all"?data.snapshots.length:history==="6"?6:12;const selectedSnapshots=data.snapshots.slice(-limit);const snapshots=selectedSnapshots.map((row)=>({label:snapshotLabel(row.asOfDate),assets:decimal(row.cashTotal.toString()).plus(row.savingsTotal.toString()).plus(row.investmentsTotal.toString()).plus(row.manualAssetsTotal.toString()).toNumber(),liabilities:decimal(row.liabilitiesTotal.toString()).toNumber(),net:decimal(row.netWorth.toString()).toNumber()}));
  const annualMap=new Map<string,number>();for(const row of data.snapshots){annualMap.set(String(civilDateFromInstant(row.asOfDate).year),decimal(row.netWorth.toString()).toNumber());}const annual=[...annualMap.entries()].map(([year,net])=>({year,net}));
  const assets=[...data.accounts.filter((row)=>row.isIncludedInNetWorth).map((row)=>({id:row.id,name:row.name,type:ACCOUNT_LABEL[row.type]??row.type,value:row.balance,href:`/contas/${row.id}`,kind:"ACCOUNT" as const})),...data.investments.filter((row)=>row.isCountedSeparately).map((row)=>({id:row.id,name:`${row.symbol} · ${row.name}`,type:row.assetClass,value:row.marketValue.toString(),href:"/investimentos",kind:"INVESTMENT" as const}))];
  const todayIso=formatCivilDateIso(civilDateFromInstant(new Date()));
  return <AppShell visualTheme="aurora" userName={user.name} workspaces={workspaces} activeWorkspaceId={selected.id} flash={flash} unseenAlertsCount={unseenAlertsCount} headerLeading={<div><h1 className="text-2xl font-bold tracking-tight">Património</h1><p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">Visão global dos teus bens, investimentos e passivos.</p></div>} headerActions={<><form method="get" className="flex items-center"><label htmlFor="history" className="sr-only">Período do histórico</label><select id="history" name="history" defaultValue={history} className="h-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"><option value="6">Últimos 6 registos</option><option value="12">Últimos 12 registos</option><option value="all">Todo o histórico</option></select><button className={filterApplyButtonClassName}>Ver</button></form><NewPatrimonyDrawer/></>}>
    <p className="mb-4 text-xs text-slate-500">Os KPI apresentam valores atuais. O seletor aplica-se apenas aos snapshots históricos.</p><MetricGrid><FinanceMetricCard label="Valor total dos ativos" value={assetsTotal.toString()} tone="income" icon={<PatrimonyIcon kind="ASSETS"/>} hint="Contas incluídas + investimentos autónomos"/><FinanceMetricCard label="Total de passivos" value={liabilitiesTotal.isZero()?formatEUR("0"): `− ${formatEUR(liabilitiesTotal.toString())}`} rawValue tone="expense" icon={<PatrimonyIcon kind="LIABILITIES"/>} hint="Capital atual em dívida"/><FinanceMetricCard label="Património líquido" value={data.netPatrimony} tone="accent" icon={<PatrimonyIcon kind="NET"/>} hint="Ativos − passivos" labelHeadingLevel={2}/><FinanceMetricCard label="Rácio de endividamento" value={debtRatio===null?"N/D":`${debtRatio.toFixed(1)}%`} rawValue tone="analytic" icon={<PatrimonyIcon kind="RATIO"/>} hint="Passivos / ativos"/></MetricGrid>
    <div className="mt-5"><PatrimonyOverviewCharts snapshots={snapshots} distribution={distribution} distributionTotal={distributionTotal}/></div>{selectedSnapshots.length<2?<form action={captureNetWorthSnapshotAction} className="mt-3 flex justify-end"><button className={primaryButtonClassName}>Registar snapshot atual</button></form>:null}
    <div className="mt-5 grid min-w-0 items-start gap-5 2xl:grid-cols-2"><AssetsTable assets={assets} total={assetsTotal.toString()}/><LiabilitiesTable liabilities={data.liabilities} total={liabilitiesTotal.toString()} accounts={data.accounts} todayIso={todayIso}/></div>
    <div className="mt-5"><PatrimonySecondaryCharts distribution={distribution} ratio={debtRatio} assets={assetsTotal.toString()} liabilities={liabilitiesTotal.toString()} annual={annual}/></div>
    <p className="mt-5 text-xs leading-5 text-slate-500">As posições `ACCOUNT_COMPONENT` não são somadas separadamente às contas. Objetivos de poupança e prestações futuras não são contabilizados como ativos ou passivos adicionais.</p>
  </AppShell>;
}
async function PatrimonioInner({searchParams}:PageProps){const params=await searchParams;const history=["6","12","all"].includes(params.history??"")?params.history!:"12";return <PatrimonioContent history={history}/>;}
export default function PatrimonioPage(props:PageProps){return <Suspense fallback={<p className="p-6 text-sm">A carregar património…</p>}><PatrimonioInner searchParams={props.searchParams}/></Suspense>;}
