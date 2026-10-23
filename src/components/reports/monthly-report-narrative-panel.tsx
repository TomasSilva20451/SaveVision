"use client";

import { useState, useTransition } from "react";
import { generateMonthlyReportNarrativeAction } from "@/lib/finance/monthly-report-actions";
import { primaryButtonClassName } from "@/components/ui/form-styles";

type Props = {
  year: number;
  month: number;
  initialNarrative: string | null;
  initialModel: string | null;
  initialPromptVersion: string | null;
  initialGeneratedAt: string | null;
};

export function MonthlyReportNarrativePanel({
  year,
  month,
  initialNarrative,
  initialModel,
  initialPromptVersion,
  initialGeneratedAt,
}: Props) {
  const [narrative, setNarrative] = useState(initialNarrative);
  const [model, setModel] = useState(initialModel);
  const [promptVersion, setPromptVersion] = useState(initialPromptVersion);
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function regenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateMonthlyReportNarrativeAction({ year, month });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNarrative(result.narrative);
      setModel(result.model);
      setPromptVersion(result.promptVersion);
      setGeneratedAt(new Date().toISOString());
    });
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold">Resumo narrativo do mês</h2>
          <p className="mt-1 text-sm text-slate-500">
            Texto gerado a partir de totais calculados no servidor (sem enviar transações ao modelo).
          </p>
        </div>
        <button type="button" className={primaryButtonClassName} disabled={pending} onClick={regenerate}>
          {pending ? "A gerar…" : narrative ? "Regenerar resumo" : "Gerar resumo"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {narrative ? (
        <>
          <p className="mt-4 text-sm leading-7 text-slate-800">{narrative}</p>
          <dl className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
            <div>
              <dt className="font-medium text-slate-600">Modelo</dt>
              <dd>{model ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-600">Versão do prompt</dt>
              <dd>{promptVersion ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-600">Gerado em</dt>
              <dd>
                {generatedAt
                  ? new Intl.DateTimeFormat("pt-PT", {
                      timeZone: "Europe/Lisbon",
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(generatedAt))
                  : "—"}
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          Ainda não existe resumo para este mês. O fallback determinístico garante texto mesmo sem Ollama.
        </p>
      )}

      <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 dark:bg-slate-900">
        O resumo não substitui aconselhamento financeiro. Não inclui recomendações de investimento nem garantias.
        Os montantes de origem ficam guardados para auditoria e regeneração.
      </p>
    </section>
  );
}
