import type { ReactNode } from "react";

type CardProps = {
  title?: string;
  children: ReactNode;
  className?: string;
};

export function Card({ title, children, className = "" }: CardProps) {
  return (
    <section
      className={`rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 ${className}`}
    >
      {title ? <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{title}</h2> : null}
      <div className={title ? "mt-3" : undefined}>{children}</div>
    </section>
  );
}
