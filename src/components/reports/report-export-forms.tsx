"use client";

import { useState } from "react";

type Props = {
  defaultFrom: string;
  defaultTo: string;
};

export function ReportExportForms({ defaultFrom, defaultTo }: Props) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [includeNarrative, setIncludeNarrative] = useState(true);
  const narrativeParam = includeNarrative ? "1" : "0";

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          De
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Até
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={includeNarrative}
          onChange={(event) => setIncludeNarrative(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        Incluir resumo narrativo do mês (se existir em Relatórios)
      </label>
      <div className="flex flex-wrap gap-3">
        <a
          href={`/api/reports/csv?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&includeNarrative=${narrativeParam}`}
          className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          ↓ Exportar CSV
        </a>
        <a
          href={`/api/reports/pdf?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&includeNarrative=${narrativeParam}`}
          className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
        >
          ↓ Exportar PDF
        </a>
      </div>
    </div>
  );
}
