"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { navLinkClassName } from "@/components/ui/form-styles";

const primary = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/contas", label: "Contas" },
  { href: "/transacoes", label: "Transações" },
  { href: "/orcamentos", label: "Orçamentos" },
  { href: "/despesas-recorrentes", label: "Despesas recorrentes" },
  { href: "/receitas", label: "Receitas" },
  { href: "/patrimonio", label: "Património" },
  { href: "/previsoes", label: "Previsões" },
  { href: "/analises", label: "Análises" },
  { href: "/alertas", label: "Alertas", badgeKey: "alerts" as const },
  { href: "/simulacoes", label: "Simulações" },
] as const;

const more = [
  { href: "/inicio", label: "Início" },
  { href: "/assistente", label: "Assistente" },
  { href: "/despesas", label: "Despesas" },
  { href: "/planeamento", label: "Planeamento" },
  { href: "/conta-conjunta", label: "Conta conjunta" },
  { href: "/relatorios", label: "Relatórios" },
  { href: "/investimentos", label: "Investimentos" },
  { href: "/perfil", label: "Conta e perfil" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/inicio") return pathname === "/inicio";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      {children}
    </svg>
  );
}

const icons: Record<string, ReactNode> = {
  "/dashboard": <Icon><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" /></Icon>,
  "/contas": <Icon><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></Icon>,
  "/transacoes": <Icon><path d="M7 7h10M7 12h10M7 17h6" /></Icon>,
  "/orcamentos": <Icon><path d="M4 19V5M4 19h16" /><path d="M8 15V9M12 15V7M16 15v-3" /></Icon>,
  "/despesas-recorrentes": <Icon><path d="M4 12a8 8 0 1 0 2.3-5.7" /><path d="M4 4v4h4" /></Icon>,
  "/receitas": <Icon><path d="M12 19V5M7 10l5-5 5 5" /></Icon>,
  "/patrimonio": <Icon><path d="M4 20h16M6 20V10l6-6 6 6v10" /></Icon>,
  "/previsoes": <Icon><path d="M4 16l5-5 4 4 7-8" /></Icon>,
  "/analises": <Icon><path d="M5 19V9M12 19V5M19 19v-7" /></Icon>,
  "/alertas": <Icon><path d="M6 16V10a6 6 0 1 1 12 0v6l1.5 2H4.5z" /><path d="M10 19a2 2 0 0 0 4 0" /></Icon>,
  "/simulacoes": <Icon><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></Icon>,
  "/inicio": <Icon><circle cx="12" cy="12" r="3" /></Icon>,
  "/assistente": <Icon><path d="M7 8h10M7 12h6M7 16h8" /><circle cx="17" cy="16" r="2" /></Icon>,
  "/despesas": <Icon><path d="M12 5v14M17 14l-5 5-5-5" /></Icon>,
  "/planeamento": <Icon><path d="M8 6h8M8 12h8M8 18h5" /></Icon>,
  "/conta-conjunta": <Icon><circle cx="9" cy="10" r="3" /><circle cx="16" cy="11" r="2.5" /></Icon>,
  "/relatorios": <Icon><path d="M7 4h7l4 4v12H7z" /></Icon>,
  "/investimentos": <Icon><path d="M4 18l6-6 3 3 7-8" /></Icon>,
  "/perfil": <Icon><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></Icon>,
};

type MainNavProps = {
  id?: string;
  className?: string;
  onNavigate?: () => void;
  unseenAlertsCount?: number;
};

function NavList({
  items,
  pathname,
  onNavigate,
  unseenAlertsCount,
}: {
  items: readonly { href: string; label: string; badgeKey?: "alerts" }[];
  pathname: string;
  onNavigate?: () => void;
  unseenAlertsCount: number;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              className={navLinkClassName(active)}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
            >
              {icons[link.href]}
              <span className="min-w-0 flex-1 truncate">{link.label}</span>
              {link.badgeKey === "alerts" && unseenAlertsCount > 0 ? (
                <span
                  className="inline-flex min-w-[1.25rem] justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold text-white"
                  aria-label={`${unseenAlertsCount} alertas por ver`}
                >
                  {unseenAlertsCount > 99 ? "99+" : unseenAlertsCount}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function MainNav({
  id,
  className = "",
  onNavigate,
  unseenAlertsCount = 0,
}: MainNavProps) {
  const pathname = usePathname();

  return (
    <nav id={id} className={className} aria-label="Principal">
      <NavList
        items={primary}
        pathname={pathname}
        onNavigate={onNavigate}
        unseenAlertsCount={unseenAlertsCount}
      />
      <p className="mb-1 mt-5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Mais
      </p>
      <NavList
        items={more}
        pathname={pathname}
        onNavigate={onNavigate}
        unseenAlertsCount={0}
      />
    </nav>
  );
}
