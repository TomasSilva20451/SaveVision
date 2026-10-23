import type { ReactNode } from "react";

type CardProps = {
  title?: string;
  children: ReactNode;
  className?: string;
};

export function Card({ title, children, className = "" }: CardProps) {
  return (
    <section
      className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] ${className}`}
    >
      {title ? <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{title}</h2> : null}
      <div className={title ? "mt-3" : undefined}>{children}</div>
    </section>
  );
}
