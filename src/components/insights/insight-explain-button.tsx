"use client";

import { useActionState } from "react";
import {
  explainFinancialInsightAction,
  type ExplainActionState,
} from "@/lib/finance/natural-language-explanation-actions";
import { secondaryButtonClassName } from "@/components/ui/form-styles";

function ExplanationBody({ state }: { state: ExplainActionState }) {
  if (!state) return null;
  if (!state.ok) {
    return <p className="mt-2 text-xs text-amber-700">{state.error}</p>;
  }

  return (
    <div className="mt-2 space-y-1.5 rounded-lg border border-blue-200/60 bg-blue-50/40 p-2.5 text-xs">
      <p className="text-slate-800">{state.explanation.factualExplanation}</p>
      {state.explanation.optionalSuggestion ? (
        <p className="text-amber-800">
          <strong>Sugestão (não garantida):</strong> {state.explanation.optionalSuggestion}
        </p>
      ) : null}
    </div>
  );
}

export function InsightExplainButton({ insightId }: { insightId: string }) {
  const [state, action, pending] = useActionState(explainFinancialInsightAction, null);

  return (
    <div className="mt-2">
      <form action={action}>
        <input type="hidden" name="insightId" value={insightId} />
        <button type="submit" className={`${secondaryButtonClassName} text-xs`} disabled={pending}>
          {pending ? "A explicar…" : "Explicar padrão"}
        </button>
      </form>
      <ExplanationBody state={state} />
    </div>
  );
}
