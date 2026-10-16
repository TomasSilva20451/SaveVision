"use client";

import { useState } from "react";

type Props = {
  defaultFrom: string;
  defaultTo: string;
};

export function ReportExportForms({ defaultFrom, defaultTo }: Props) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  return (
    <div className="mt-6 grid max-w-md gap-4">
      <div className="grid gap-2">
        <label className="text-sm">
          De
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="text-sm">
          Até
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        <a
          href={`/api/reports/csv?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Exportar CSV
        </a>
        <a
          href={`/api/reports/pdf?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}
          className="rounded-lg border px-3 py-2 text-sm dark:border-zinc-700"
        >
          Exportar PDF
        </a>
      </div>
    </div>
  );
}
