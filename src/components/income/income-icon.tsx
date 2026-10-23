import type { ReactNode } from "react";

const paths: Record<string, ReactNode> = {
  TOTAL: <><ellipse cx="12" cy="6" rx="6" ry="3"/><path d="M6 6v4c0 1.7 2.7 3 6 3s6-1.3 6-3V6M6 10v4c0 1.7 2.7 3 6 3s6-1.3 6-3v-4M8 17v1c0 1.7 2.2 3 5 3s5-1.3 5-3v-4"/></>,
  FAMILY_TRANSFER: <><path d="M7 7h10M7 7l3-3M7 7l3 3"/><path d="M17 17H7m10 0-3-3m3 3-3 3"/></>,
  ECOMMERCE: <><path d="M4 7h16l-1.5 9h-13z"/><path d="M8 7l1-3h6l1 3M9 20h.01M15 20h.01"/></>,
  TENNIS_PRIZE: <><circle cx="12" cy="12" r="8"/><path d="M6.5 7.5c3 2 4 5 3 9M17.5 16.5c-3-2-4-5-3-9"/></>,
  SALARY: <><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M8 6V4h8v2M3 11h18M12 10v3"/></>,
  FREELANCE: <><path d="M4 5h16v12H4z"/><path d="M8 21h8M12 17v4"/></>,
  GIFT: <><path d="M3 9h18v4H3zM5 13h14v8H5zM12 9v12"/><path d="M12 9H8.5a2.5 2.5 0 1 1 2.2-3.7L12 9Zm0 0h3.5a2.5 2.5 0 1 0-2.2-3.7L12 9Z"/></>,
  INTEREST: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></>,
  OTHER: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
};

export function IncomeIcon({ kind, className = "h-5 w-5" }: { kind: string; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {paths[kind] ?? paths.OTHER}
    </svg>
  );
}
