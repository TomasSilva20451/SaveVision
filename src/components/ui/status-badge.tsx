import type { ReactNode } from "react";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "muted" | "analytic";

const styles: Record<BadgeVariant, string> = {
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warning: "bg-amber-50 text-amber-900 ring-amber-200",
  danger: "bg-rose-50 text-rose-800 ring-rose-200",
  info: "bg-blue-50 text-blue-800 ring-blue-200",
  muted: "bg-slate-100 text-slate-700 ring-slate-200",
  analytic: "bg-violet-50 text-violet-800 ring-violet-200",
};

export function StatusBadge({
  children,
  variant = "muted",
}: {
  children: ReactNode;
  variant?: BadgeVariant;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[variant]}`}
    >
      {children}
    </span>
  );
}
