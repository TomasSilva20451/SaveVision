import Link from "next/link";
import { appConfig } from "@/lib/config";
import { TIME_ZONE } from "@/lib/datetime/civil-date";

type DashboardHeaderProps = {
  unseenAlertsCount?: number;
};

function formatCurrentPeriod(): string {
  const label = new Intl.DateTimeFormat(appConfig.locale, {
    month: "long",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(new Date());
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function DashboardGreeting({ userName }: { userName: string }) {
  const firstName = userName.trim().split(/\s+/)[0] ?? userName;

  return (
    <div className="min-w-0">
      <h1 className="sr-only">Dashboard</h1>
      <p className="truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-50">
        Olá, {firstName}!{" "}
        <span className="inline-block" aria-hidden>
          👋
        </span>
      </p>
      <p className="mt-0.5 truncate text-sm text-slate-500">
        Aqui está um resumo da tua situação financeira.
      </p>
    </div>
  );
}

export function DashboardHeaderActions({ unseenAlertsCount = 0 }: DashboardHeaderProps) {
  return (
    <>
      <span
        className="hidden items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-slate-600 shadow-sm sm:inline-flex"
        title="Mês civil actual (Europe/Lisbon)"
      >
        <span aria-hidden>📅</span>
        {formatCurrentPeriod()}
      </span>
      <Link
        href="/alertas"
        className="relative inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-sm hover:bg-slate-50"
        aria-label={
          unseenAlertsCount > 0 ? `Alertas (${unseenAlertsCount} por ver)` : "Ver alertas"
        }
      >
        <span aria-hidden>🔔</span>
        {unseenAlertsCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {unseenAlertsCount > 9 ? "9+" : unseenAlertsCount}
          </span>
        ) : null}
      </Link>
    </>
  );
}
