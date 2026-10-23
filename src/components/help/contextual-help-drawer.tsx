"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { askContextualHelpAction, explainCurrentPageAction } from "@/lib/help/contextual-help-actions";
import { inputClassName, primaryButtonClassName, secondaryButtonClassName } from "@/components/ui/form-styles";

const SUGGESTIONS: Record<string, string[]> = {
  "/despesas-recorrentes": [
    "Como anulo o pagamento de uma recorrência?",
    "O que significa adiar uma ocorrência?",
  ],
  "/conta-conjunta": ["Como crio uma conta conjunta?", "Quem vê os dados do workspace conjunto?"],
  "/relatorios": ["Como exporto um relatório?", "O que é o resumo narrativo?"],
  "/simulacoes": ["Qual é a diferença entre previsão e simulação?"],
  "/perfil": ["Onde altero a fotografia de perfil?"],
  "/contas": ["Porque não posso eliminar esta conta?"],
};

type Props = {
  onClose: () => void;
};

export function ContextualHelpDrawer({ onClose }: Props) {
  const pathname = usePathname() ?? "/";
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ model: string; pageTitle: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const routeKey = pathname.split("?")[0]?.replace(/\/$/, "") || "/";
  const suggestions = SUGGESTIONS[routeKey] ?? [
    "Como exporto um relatório?",
    "Qual é a diferença entre previsão e simulação?",
  ];

  function explainPage() {
    setError(null);
    startTransition(async () => {
      const result = await explainCurrentPageAction(pathname);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAnswer(result.answer);
      setMeta({ model: result.model, pageTitle: result.pageTitle });
    });
  }

  function submit(text?: string) {
    const q = (text ?? question).trim();
    if (q.length < 4) return;
    setError(null);
    startTransition(async () => {
      const result = await askContextualHelpAction({ question: q, pathname });
      if (!result.ok) {
        setError(result.error);
        setAnswer(null);
        return;
      }
      setQuestion(q);
      setAnswer(result.answer);
      setMeta({ model: result.model, pageTitle: result.pageTitle });
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 p-0 sm:p-4" role="presentation" onClick={onClose}>
      <div
        key={routeKey}
        ref={panelRef}
        role="dialog"
        aria-labelledby="contextual-help-title"
        aria-modal="true"
        className="flex h-full w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-xl sm:h-auto sm:max-h-[min(720px,100vh)] sm:rounded-2xl sm:border"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Processado localmente</p>
            <h2 id="contextual-help-title" className="text-lg font-semibold">
              Ajuda contextual
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Respostas com base na documentação FinTwin. Não acede aos teus movimentos financeiros.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button type="button" className={secondaryButtonClassName} disabled={pending} onClick={explainPage}>
              Explicar esta página
            </button>
            <button type="button" className={secondaryButtonClassName} onClick={onClose}>
              Fechar
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <label className="block text-sm font-medium text-slate-700">
            Pergunta
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Ex.: Como crio uma conta conjunta?"
              className={`${inputClassName} mt-1 resize-y`}
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((item) => (
              <button
                key={item}
                type="button"
                className="rounded-full border border-[var(--border)] bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:bg-slate-900"
                onClick={() => submit(item)}
                disabled={pending}
              >
                {item}
              </button>
            ))}
          </div>

          <button type="button" className={`${primaryButtonClassName} mt-4 w-full`} disabled={pending} onClick={() => submit()}>
            {pending ? "A pesquisar documentação…" : "Obter resposta"}
          </button>

          {error ? (
            <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          {answer ? (
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-slate-50/80 px-4 py-3 dark:bg-slate-900/40">
              {meta ? (
                <p className="text-xs font-medium text-slate-500">
                  Contexto: {meta.pageTitle} · Modelo: {meta.model}
                </p>
              ) : null}
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-800">{answer}</p>
            </div>
          ) : null}

          <p className="mt-4 text-xs leading-5 text-slate-500">
            Enviado ao modelo: a tua pergunta, o nome da página actual e excertos da documentação interna. Não enviamos
            transações, passwords nem variáveis de ambiente. Para números do teu mês, usa o Assistente financeiro.
          </p>
        </div>
      </div>
    </div>
  );
}
