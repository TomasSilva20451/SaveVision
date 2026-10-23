import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div
      className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900/40"
      role="status"
    >
      <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
