import Link from "next/link";
import { AlertIcon } from "@/components/alerts/alert-icon";
import { civilDateFromInstant } from "@/lib/datetime/civil-date";
import { formatEUR } from "@/lib/finance/money";
import { treasuryEventSourceLabel, type TreasuryForecastEvent } from "@/lib/finance/treasury-forecast";

function shortDate(date:Date){return new Intl.DateTimeFormat("pt-PT",{timeZone:"Europe/Lisbon",day:"2-digit",month:"short",year:"numeric"}).format(date).replaceAll(" de "," ").replace(".","");}
function civilOrdinal(date:Date){const part=civilDateFromInstant(date); return Math.floor(Date.UTC(part.year,part.month-1,part.day)/86_400_000);}

export function AlertsUpcoming({ events, now }: { events:TreasuryForecastEvent[]; now:Date }) {
  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]"><div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold">Próximos vencimentos</h2><Link href="/previsoes" className="text-xs font-medium text-blue-700">Ver todos →</Link></div><p className="mt-1 text-xs text-slate-500">Eventos financeiros previstos, não novos alertas.</p>{events.length===0?<p className="mt-5 text-sm text-slate-500">Sem vencimentos futuros com data fiável.</p>:<ul className="mt-3 divide-y divide-[var(--border)]">{events.slice(0,5).map((event)=>{const days=civilOrdinal(event.dueDate)-civilOrdinal(now); return <li key={`${event.source}-${event.id}`} className="flex items-center gap-3 py-3"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${event.direction==="outflow"?"bg-amber-50 text-amber-700":"bg-blue-50 text-blue-700"}`}><AlertIcon kind="CALENDAR" className="h-4 w-4"/></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{event.label}</p><p className="text-xs text-slate-500">{treasuryEventSourceLabel(event.source)}</p></div><div className="text-right"><p className="whitespace-nowrap text-xs font-medium">{shortDate(event.dueDate)}</p><p className="text-[11px] text-slate-500">{days===0?"Hoje":days===1?"Amanhã":`em ${days} dias`} · {event.direction==="outflow"?"−":"+"}{formatEUR(event.amount)}</p></div></li>})}</ul>}</section>;
}
