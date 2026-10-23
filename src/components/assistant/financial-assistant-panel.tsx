"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { askFinancialAssistantAction } from "@/lib/finance/financial-assistant-actions";
import {
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/ui/form-styles";

const examples = [
  "Quanto gastei em Alimentação este mês?",
  "Que categorias aumentaram nos últimos 3 meses?",
  "Qual é a minha taxa de poupança?",
  "Que pagamentos tenho nos próximos 7 dias?",
  "Consigo poupar 300 € por mês?",
];

export function FinancialAssistantPanel() {
  const [question, setQuestion] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Awaited<ReturnType<typeof askFinancialAssistantAction>> | null>(
    null,
  );

  function submit(nextQuestion?: string) {
    const q = (nextQuestion ?? question).trim();
    if (!q) return;
    setQuestion(q);
    startTransition(async () => {
      const response = await askFinancialAssistantAction(q);
      setResult(response);
    });
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Assistente financeiro (local)</h2>
          <p className="mt-1 text-sm text-slate-500">
            Perguntas em português; o Ollama interpreta a intenção e o servidor calcula a resposta com os teus
            dados. Só leitura — nada é alterado.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          qwen3.5 local
        </span>
      </div>

      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label className="min-w-0 flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          A tua pergunta
          <textarea
            name="question"
            rows={2}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ex.: Quanto gastei em Transportes nos últimos 3 meses?"
            className={`${inputClassName} mt-1 resize-y`}
            maxLength={500}
            disabled={pending}
          />
        </label>
        <button type="submit" className={primaryButtonClassName} disabled={pending || question.trim().length < 4}>
          {pending ? "A analisar…" : "Perguntar"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {examples.map((sample) => (
          <button
            key={sample}
            type="button"
            className={secondaryButtonClassName}
            disabled={pending}
            onClick={() => submit(sample)}
          >
            {sample}
          </button>
        ))}
      </div>

      {result ? (
        <div
          className="mt-5 rounded-xl border border-[var(--border)] bg-slate-50/80 p-4 dark:bg-slate-900/40"
          aria-live="polite"
        >
          {result.ok ? (
            <>
              <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-100">{result.answer}</p>
              {result.dataIncomplete ? (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  Nota: a amostra de movimentos foi limitada; o valor pode estar incompleto.
                </p>
              ) : null}
              {result.evidence.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
                  {result.evidence.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
              {result.links.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {result.links.map((link) => (
                    <Link key={link.href + link.label} href={link.href} className={secondaryButtonClassName}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              ) : null}
              <p className="mt-3 text-xs text-slate-400">
                Intenção: {result.intent} · confiança {Math.round(result.confidence * 100)}%
              </p>
            </>
          ) : (
            <p className="text-sm text-rose-700 dark:text-rose-300">{result.error}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
