import type { ReactNode } from "react";

type FinanceTableProps = {
  caption?: string;
  children: ReactNode;
  className?: string;
};

export function FinanceTable({ caption, children, className = "" }: FinanceTableProps) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full min-w-[640px] border-collapse text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

export function FinanceTableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-[var(--border)] text-left text-xs font-medium uppercase tracking-wide text-slate-500">
        {children}
      </tr>
    </thead>
  );
}

export function FinanceTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-[var(--border)]">{children}</tbody>;
}

export function FinanceTableRow({ children }: { children: ReactNode }) {
  return <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40">{children}</tr>;
}

export function FinanceTableCell({
  children,
  align = "left",
  className = "",
}: {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={`py-3 pr-4 align-middle ${align === "right" ? "text-right tabular-nums" : ""} ${className}`}
    >
      {children}
    </td>
  );
}

export function FinanceTableHeaderCell({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th scope="col" className={`pb-3 pr-4 font-medium ${align === "right" ? "text-right" : ""}`}>
      {children}
    </th>
  );
}
