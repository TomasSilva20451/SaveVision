import type { ReactNode } from "react";

const paths: Record<string, ReactNode> = {
  CRITICAL: <><path d="M12 3 2.7 20h18.6L12 3Z"/><path d="M12 9v4m0 3h.01"/></>,
  HIGH: <><path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  ATTENTION: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  INFO: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/></>,
  RESOLVED: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
  CALENDAR: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
};

export function AlertIcon({ kind, className = "h-5 w-5" }: { kind: string; className?: string }) {
  return <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>{paths[kind] ?? paths.INFO}</svg>;
}
