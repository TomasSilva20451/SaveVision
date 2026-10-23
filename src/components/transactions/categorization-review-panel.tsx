"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  applyCategorizationReviewAction,
  computeCategorizationSuggestionsAction,
  listCategorizationReviewsAction,
} from "@/lib/finance/transaction-categorization-actions";
import { primaryButtonClassName, secondaryButtonClassName } from "@/components/ui/form-styles";
import { formatEUR } from "@/lib/finance/money";

type ReviewRow = {
  suggestionId: string;
  transactionId: string;
  occurredAt: string;
  description: string;
  amount: string;
  type: "INCOME" | "EXPENSE";
  currentCategoryName: string | null;
  suggestedCategoryName: string | null;
  suggestedMerchant: string;
  confidence: number;
  source: string;
};

type Props = {
  open: boolean;
};

export function CategorizationReviewPanel({ open }: Props) {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reload = useCallback(() => {
    startTransition(async () => {
      const result = await listCategorizationReviewsAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRows(result.rows);
      setSelected(new Set());
      setError(null);
    });
  }, []);

  useEffect(() => {
    if (open) reload();
  }, [open, reload]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runBatch(accept: boolean) {
    const ids = [...selected];
    if (ids.length === 0) return;
    setMessage(null);
    startTransition(async () => {
      const result = await applyCategorizationReviewAction({ suggestionIds: ids, accept });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        accept
          ? `${result.updated} categoria(s) actualizada(s).`
          : `${result.updated} sugestão(ões) rejeitada(s).`,
      );
      reload();
    });
  }

  function generate() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await computeCategorizationSuggestionsAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.processed > 0) {
        setMessage(`${result.processed} nova(s) sugestão(ões) calculada(s).`);
      } else if (result.candidates === 0) {
        setMessage(
          "Não há movimentos por rever nos últimos 12 meses (já categorizados, em cooldown ou sem descrição).",
        );
      } else if (!result.localAiActive) {
        setMessage(
          "Foram analisados movimentos elegíveis, mas a IA local está desactivada e nenhuma regra do workspace aplicou. Activa em Conta e perfil → IA local, ou confirma categorias para criar regras.",
        );
      } else if (result.ollamaErrors > 0) {
        setMessage(
          `${result.ollamaErrors} movimento(s) falharam no Ollama (modelo, timeout ou resposta inválida). Confirma IA local e o modelo de texto.`,
        );
      } else if (result.skippedSameCategory > 0 && result.skippedNoSuggestion === 0) {
        setMessage("As propostas coincidiam com a categoria já registada — nada novo para rever.");
      } else {
        setMessage(
          "Nenhuma sugestão nova. Verifica Ollama em IA local ou confirma categorias para criar regras.",
        );
      }
      reload();
    });
  }

  if (!open) return null;

  return (
    <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Sugestões pendentes de categorização</h2>
          <p className="mt-1 text-sm text-slate-500">
            Regras do workspace e Ollama local (se activo). Nada é gravado até confirmares.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryButtonClassName} disabled={pending} onClick={generate}>
            {pending ? "A gerar…" : "Gerar sugestões"}
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={pending || selected.size === 0}
            onClick={() => runBatch(true)}
          >
            Aceitar seleccionadas
          </button>
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={pending || selected.size === 0}
            onClick={() => runBatch(false)}
          >
            Rejeitar
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Sem sugestões pendentes. Usa «Gerar sugestões» para analisar movimentos recentes.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-slate-500">
                <th className="pb-2 pr-2" />
                <th className="pb-2">Data</th>
                <th className="pb-2">Descrição</th>
                <th className="pb-2 text-right">Montante</th>
                <th className="pb-2">Actual</th>
                <th className="pb-2">Sugerida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((row) => (
                <tr key={row.suggestionId}>
                  <td className="py-2 pr-2">
                    <input
                      type="checkbox"
                      checked={selected.has(row.suggestionId)}
                      onChange={() => toggle(row.suggestionId)}
                      aria-label={`Seleccionar ${row.description}`}
                    />
                  </td>
                  <td className="py-2 whitespace-nowrap">{row.occurredAt}</td>
                  <td className="py-2 max-w-xs truncate" title={row.description}>
                    {row.description || "—"}
                  </td>
                  <td className="py-2 text-right">{formatEUR(row.amount)}</td>
                  <td className="py-2">{row.currentCategoryName ?? "Sem categoria"}</td>
                  <td className="py-2">
                    {row.suggestedCategoryName ?? "—"}
                    <span className="block text-xs text-slate-500">
                      {row.suggestedMerchant} · {row.source} · {Math.round(row.confidence * 100)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
