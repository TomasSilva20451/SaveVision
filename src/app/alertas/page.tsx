import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AlertIcon } from "@/components/alerts/alert-icon";
import { AlertsCalendar } from "@/components/alerts/alerts-calendar";
import { AlertsPriorityChart } from "@/components/alerts/alerts-priority-chart";
import { AlertsUpcoming } from "@/components/alerts/alerts-upcoming";
import { FinancialAlertsCenter } from "@/components/alerts/financial-alerts-center";
import { AppShell } from "@/components/shell/app-shell";
import { FinanceMetricCard, MetricGrid } from "@/components/ui/finance-metric-card";
import { filterApplyButtonClassName, primaryButtonClassName } from "@/components/ui/form-styles";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { civilDateFromInstant, isInstantInCivilMonth } from "@/lib/datetime/civil-date";
import { syncFinancialAlertsAction } from "@/lib/finance/financial-alert-actions";
import { readPageFlash } from "@/lib/ui/page-shell";
import { countUnseenFinancialAlerts, listFinancialAlerts, type FinancialAlertView } from "@/server/services/financial-alerts";
import { loadTreasuryContext } from "@/server/services/treasury-forecast";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

type Params = { period?:string; view?:string; type?:string; severity?:string; sort?:string; q?:string; calendar?:string; day?:string };
type PageProps = { searchParams:Promise<Params> };

function parsePeriod(value:string|undefined,fallback:{year:number;month:number}){const match=/^(\d{4})-(\d{2})$/.exec(value??"");if(!match)return fallback;const year=Number(match[1]);const month=Number(match[2]);return year>=2000&&year<=2100&&month>=1&&month<=12?{year,month}:fallback;}
function periodValue(period:{year:number;month:number}){return `${period.year}-${String(period.month).padStart(2,"0")}`;}
function periodLabel(year:number,month:number){const value=new Intl.DateTimeFormat("pt-PT",{month:"long",year:"numeric",timeZone:"Europe/Lisbon"}).format(new Date(Date.UTC(year,month-1,15,12)));return value.charAt(0).toUpperCase()+value.slice(1);}
function periodOptions(year:number,month:number){return Array.from({length:25},(_,index)=>{const date=new Date(Date.UTC(year,month-1+index-12,15,12));const item={year:date.getUTCFullYear(),month:date.getUTCMonth()+1};return {value:periodValue(item),label:periodLabel(item.year,item.month)};});}
function civilOrdinal(date:Date){const value=civilDateFromInstant(date);return Math.floor(Date.UTC(value.year,value.month-1,value.day)/86_400_000);}
function severityRank(alert:FinancialAlertView){return {CRITICAL:4,HIGH:3,ATTENTION:2,INFO:1}[alert.severity];}

async function AlertasContent({ params }: { params:Params }) {
  await ensureRequestDynamic();
  const user=await requireAuthenticatedUser(); if(!user)redirect("/login");
  const {workspaces,selected}=await resolveWorkspaceContext(user.id); if(!selected)redirect("/inicio");
  if(!(await requireWorkspaceAccess(user.id,selected.id)))redirect("/inicio");
  const today=civilDateFromInstant(new Date()); const period=parsePeriod(params.period,today); const calendarPeriod=parsePeriod(params.calendar,period);
  const [active,resolved,unseenCount,treasury,flash]=await Promise.all([
    listFinancialAlerts(user.id,selected.id,{status:"ACTIVE"}),
    listFinancialAlerts(user.id,selected.id,{status:"RESOLVED",includeDismissed:true}),
    countUnseenFinancialAlerts(user.id,selected.id),
    loadTreasuryContext(user.id,selected.id),
    readPageFlash("/alertas"),
  ]);
  if(!active||!resolved||!treasury)redirect("/inicio");
  const now=new Date(); const todayOrdinal=civilOrdinal(now);
  const resolvedInPeriod=resolved.filter((alert)=>alert.resolvedAt&&isInstantInCivilMonth(alert.resolvedAt,period.year,period.month));
  const allAlerts=[...active,...resolvedInPeriod];
  const upcoming=treasury.eventsMaxHorizon.filter((event)=>civilOrdinal(event.dueDate)>=todayOrdinal).sort((a,b)=>a.dueDate.getTime()-b.dueDate.getTime());
  const dueSoon=upcoming.filter((event)=>civilOrdinal(event.dueDate)-todayOrdinal<=7);
  const dueSourceIds=new Set(dueSoon.map((event)=>event.id));
  const dueAlertIds=active.filter((alert)=>alert.sourceId&&dueSourceIds.has(alert.sourceId)).map((alert)=>alert.id);
  const view=["all","immediate","due","info","resolved"].includes(params.view??"")?params.view!:"all";
  const type=params.type??""; const severity=params.severity??""; const sort=params.sort??"relevance"; const query=(params.q??"").trim().toLocaleLowerCase("pt-PT");
  let shown=allAlerts.filter((alert)=>view==="all"||(view==="immediate"&&alert.status==="ACTIVE"&&(alert.severity==="CRITICAL"||alert.severity==="HIGH"))||(view==="due"&&dueAlertIds.includes(alert.id))||(view==="info"&&alert.status==="ACTIVE"&&alert.severity==="INFO")||(view==="resolved"&&alert.status==="RESOLVED"));
  shown=shown.filter((alert)=>(!type||alert.type===type)&&(!severity||alert.severity===severity)&&(!query||`${alert.title} ${alert.description}`.toLocaleLowerCase("pt-PT").includes(query)));
  shown.sort((a,b)=>sort==="newest"?b.detectedAt.getTime()-a.detectedAt.getTime():sort==="oldest"?a.detectedAt.getTime()-b.detectedAt.getTime():severityRank(b)-severityRank(a)||b.detectedAt.getTime()-a.detectedAt.getTime());
  const counts={CRITICAL:0,HIGH:0,ATTENTION:0,INFO:0}; for(const alert of active)counts[alert.severity]+=1;
  const currentPeriod=periodValue(period); const options=periodOptions(period.year,period.month);
  const baseParams:Record<string,string>={}; if(view!=="all")baseParams.view=view;if(type)baseParams.type=type;if(severity)baseParams.severity=severity;if(sort!=="relevance")baseParams.sort=sort;if(params.q)baseParams.q=params.q;baseParams.period=currentPeriod;
  const immediate=active.filter((alert)=>alert.severity==="CRITICAL"||alert.severity==="HIGH").length;
  const info=active.filter((alert)=>alert.severity==="INFO").length;
  const kpiHref=(target:string)=>target==="all"?`/alertas?period=${currentPeriod}`:`/alertas?period=${currentPeriod}&view=${target}`;

  return <AppShell visualTheme="aurora" userName={user.name} workspaces={workspaces} activeWorkspaceId={selected.id} flash={flash} unseenAlertsCount={unseenCount}
    headerLeading={<div><h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">Alertas</h1><p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">Fica atento ao que realmente importa na tua vida financeira.</p></div>}
    headerActions={<><form method="get" className="flex items-center"><label htmlFor="alerts-period" className="sr-only">Período dos alertas resolvidos</label><select id="alerts-period" name="period" defaultValue={currentPeriod} className="h-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm">{options.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select><button className={filterApplyButtonClassName}>Ver</button></form><form action={syncFinancialAlertsAction}><button className={primaryButtonClassName}>Atualizar alertas</button></form></>}>
    <p className="mb-4 text-xs text-slate-500">O período aplica-se aos alertas resolvidos e ao calendário. Os riscos ativos permanecem sempre visíveis.</p>
    <MetricGrid>
      <FinanceMetricCard label="Ação imediata" value={String(immediate)} rawValue tone="expense" icon={<AlertIcon kind="HIGH"/>} hint="Críticos e de prioridade alta" href={kpiHref("immediate")}/>
      <FinanceMetricCard label="A vencer em breve" value={String(dueSoon.length)} rawValue tone="warning" icon={<AlertIcon kind="ATTENTION"/>} hint="Eventos reais nos próximos 7 dias; pode sobrepor prioridades"/>
      <FinanceMetricCard label="Informativos" value={String(info)} rawValue tone="accent" icon={<AlertIcon kind="INFO"/>} hint="Alertas ativos de caráter informativo" href={kpiHref("info")}/>
      <FinanceMetricCard label="Resolvidos" value={String(resolvedInPeriod.length)} rawValue tone="income" icon={<AlertIcon kind="RESOLVED"/>} hint={`No período ${periodLabel(period.year,period.month)}`} href={kpiHref("resolved")}/>
    </MetricGrid>
    <div className="mt-5 grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(19rem,3fr)]"><FinancialAlertsCenter alerts={shown} allAlerts={allAlerts} dueSoonIds={dueAlertIds} view={view} type={type} severity={severity} sort={sort} query={params.q??""}/><div className="space-y-5"><AlertsPriorityChart counts={counts}/><AlertsUpcoming events={upcoming} now={now}/><AlertsCalendar year={calendarPeriod.year} month={calendarPeriod.month} selectedDay={params.day??""} events={upcoming} baseParams={baseParams}/></div></div>
  </AppShell>;
}

async function AlertasPageInner({searchParams}:PageProps){return <AlertasContent params={await searchParams}/>;}
export default function AlertasPage(props:PageProps){return <Suspense fallback={<p className="p-6 text-sm">A carregar alertas…</p>}><AlertasPageInner searchParams={props.searchParams}/></Suspense>;}
