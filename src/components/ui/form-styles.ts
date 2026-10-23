export const inputClassName =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-visible:ring-zinc-100/20";

export const labelClassName = "block text-sm font-medium text-zinc-800 dark:text-zinc-200";

export const primaryButtonClassName =
  "inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60";

export const secondaryButtonClassName =
  "inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800";

export const filterApplyButtonClassName =
  "ml-1 inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium transition duration-150 hover:-translate-y-0.5 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:hover:border-blue-500 dark:hover:bg-blue-950/60 dark:hover:text-blue-200";

export const navLinkClassName = (active: boolean) =>
  [
    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400",
    active
      ? "bg-blue-600 text-white shadow-sm"
      : "text-slate-300 hover:bg-white/10 hover:text-white",
  ].join(" ");
