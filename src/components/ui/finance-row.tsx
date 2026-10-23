import type { ReactNode } from "react";

export function FinanceRow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm shadow-sm ${className}`}
    >
      {children}
    </li>
  );
}

export function FinanceTableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
      <table className="min-w-full divide-y divide-slate-100 text-sm">{children}</table>
    </div>
  );
}
