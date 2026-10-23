"use client";

import { useActionState } from "react";
import {
  explainFinancialAlertAction,
  type ExplainActionState,
} from "@/lib/finance/natural-language-explanation-actions";
import { secondaryButtonClassName } from "@/components/ui/form-styles";

function ExplanationBody({ state }: { state: ExplainActionState }) {
  if (!state) return null;
  if (!state.ok) {
    return <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{state.error}</p>;
  }

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-blue-200/70 bg-blue-50/50 p-3 text-sm dark:border-blue-400/20 dark:bg-blue-500/10">
      <p className="text-slate-800 dark:text-slate-100">{state.explanation.factualExplanation}</p>
      <p className="text-xs text-slate-600 dark:text-slate-300">{state.explanation.impactHighlight}</p>
      <p className="text-xs text-slate-500">{state.explanation.severityExplanation}</p>
      <p className="text-xs text-slate-600">{state.explanation.availableActionsSummary}</p>
      {state.explanation.optionalSuggestion ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
          <strong>Sugestão (não garantida):</strong> {state.explanation.optionalSuggestion}
        </p>
      ) : null}
      {state.dataIncomplete ? (
        <p className="text-[11px] text-slate-500">Resposta baseada em dados parciais do workspace.</p>
      ) : null}
      <p className="text-[10px] uppercase tracking-wide text-slate-400">
        {state.source === "OLLAMA" ? "Linguagem local (Ollama)" : "Texto determinístico"}
      </p>
    </div>
  );
}

export function AlertExplainButton({ alertId }: { alertId: string }) {
  const [state, action, pending] = useActionState(explainFinancialAlertAction, null);

  return (
    <div className="w-full sm:w-auto">
      <form action={action}>
        <input type="hidden" name="alertId" value={alertId} />
        <button type="submit" className={secondaryButtonClassName} disabled={pending} aria-busy={pending}>
          {pending ? "A explicar…" : "Explicar alerta"}
        </button>
      </form>
      <ExplanationBody state={state} />
    </div>
  );
}
