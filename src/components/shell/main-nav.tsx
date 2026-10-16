"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navLinkClassName } from "@/components/ui/form-styles";

const links = [
  { href: "/inicio", label: "Início" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/alertas", label: "Alertas", badgeKey: "alerts" as const },
  { href: "/analises", label: "Análises" },
  { href: "/contas", label: "Contas" },
  { href: "/transacoes", label: "Transações" },
  { href: "/receitas", label: "Receitas" },
  { href: "/despesas", label: "Despesas" },
  { href: "/despesas-recorrentes", label: "Recorrentes" },
  { href: "/orcamentos", label: "Orçamentos" },
  { href: "/patrimonio", label: "Património" },
  { href: "/planeamento", label: "Planeamento" },
  { href: "/conta-conjunta", label: "Conta conjunta" },
  { href: "/relatorios", label: "Relatórios" },
  { href: "/investimentos", label: "Investimentos" },
  { href: "/previsoes", label: "Previsões" },
  { href: "/simulacoes", label: "Simulações" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/inicio") return pathname === "/inicio";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type MainNavProps = {
  id?: string;
  className?: string;
  onNavigate?: () => void;
  unseenAlertsCount?: number;
};

export function MainNav({
  id,
  className = "",
  onNavigate,
  unseenAlertsCount = 0,
}: MainNavProps) {
  const pathname = usePathname();

  return (
    <nav id={id} className={className} aria-label="Principal">
      <ul className="flex flex-col gap-0.5">
        {links.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={navLinkClassName(active)}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
              >
                <span className="flex items-center gap-2">
                  {link.label}
                  {"badgeKey" in link &&
                  link.badgeKey === "alerts" &&
                  unseenAlertsCount > 0 ? (
                    <span
                      className="inline-flex min-w-[1.25rem] justify-center rounded-full bg-amber-600 px-1.5 text-xs font-semibold text-white"
                      aria-label={`${unseenAlertsCount} alertas por ver`}
                    >
                      {unseenAlertsCount > 99 ? "99+" : unseenAlertsCount}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
