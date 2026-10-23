"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createTransferAction } from "@/lib/finance/actions";
import {
  suggestTransactionCategorizationAction,
  type CategorizationActionResult,
} from "@/lib/finance/transaction-categorization-actions";
import { createExpenseAction, createIncomeAction } from "@/lib/finance/income-actions";
import {
  inputClassName,
  labelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/ui/form-styles";
import { SideDrawer } from "@/components/ui/side-drawer";

type AccountOption = { id: string; name: string };
type CategoryOption = { id: string; name: string; nature: "NECESSARY" | "DISCRETIONARY" };
type Suggestion = Extract<CategorizationActionResult, { ok: true }>["suggestion"];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={primaryButtonClassName} disabled={pending} aria-busy={pending}>
      {pending ? "A guardar…" : label}
    </button>
  );
}

export function NewTransactionDrawer({
  accounts,
  categories,
}: {
  accounts: AccountOption[];
  categories: CategoryOption[];
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"expense" | "income" | "transfer">("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [suggestionError, setSuggestionError] = useState("");
  const [suggestionPending, setSuggestionPending] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const requestSequence = useRef(0);
  const lastFingerprint = useRef("");

  const categoryOptions = useMemo(() => {
    const merged = new Map(categories.map((category) => [category.id, category]));
    for (const category of suggestion?.availableCategories ?? []) merged.set(category.id, category);
    return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-PT"));
  }, [categories, suggestion]);

  const requestSuggestion = useCallback(async (force = false) => {
    if (mode === "transfer" || description.trim().length < 3 || !amount.trim()) return;
    const fingerprint = `${mode}:${description.trim()}:${amount.trim()}`;
    if (!force && fingerprint === lastFingerprint.current) return;
    lastFingerprint.current = fingerprint;
    const sequence = ++requestSequence.current;
    setSuggestionPending(true);
    setSuggestionError("");
    const result = await suggestTransactionCategorizationAction({
      description,
      amount,
      direction: mode === "income" ? "INCOME" : "EXPENSE",
    });
    if (sequence !== requestSequence.current) return;
    setSuggestionPending(false);
    if (!result.ok) {
      setSuggestion(null);
      setSuggestionError(result.error);
      return;
    }
    setSuggestion(result.suggestion);
    if (result.suggestion.categoryId && result.suggestion.transactionType !== "TRANSFER") {
      setCategoryId(result.suggestion.categoryId);
    }
  }, [amount, description, mode]);

  useEffect(() => {
    if (!open || mode === "transfer" || description.trim().length < 3 || !amount.trim()) return;
    const timer = window.setTimeout(() => void requestSuggestion(), 900);
    return () => window.clearTimeout(timer);
  }, [amount, description, mode, open, requestSuggestion]);

  function selectMode(nextMode: "expense" | "income" | "transfer") {
    requestSequence.current += 1;
    lastFingerprint.current = "";
    setMode(nextMode);
    setCategoryId("");
    setSuggestion(null);
    setSuggestionError("");
    setSuggestionPending(false);
  }

  const submitLabel =
    mode === "transfer" ? "Registar transferência" : mode === "income" ? "Registar receita" : "Registar despesa";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={primaryButtonClassName}
        onClick={() => setOpen(true)}
      >
        + Nova transação
      </button>
      <SideDrawer open={open} onClose={() => setOpen(false)} titleId={titleId} returnFocusRef={triggerRef}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              Nova transação
            </h2>
            <p className="mt-1 text-sm text-slate-500">Regista uma operação financeira.</p>
          </div>
          <button type="button" className={secondaryButtonClassName} onClick={() => setOpen(false)}>
            Fechar
          </button>
        </div>
        <div className="flex flex-wrap gap-2 px-5 pt-4">
          {(
            [
              ["expense", "Despesa"],
              ["income", "Receita"],
              ["transfer", "Transferência"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={mode === value ? primaryButtonClassName : secondaryButtonClassName}
              onClick={() => selectMode(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === "transfer" && accounts.length < 2 ? (
          <p className="px-5 py-6 text-sm text-slate-600">São necessárias pelo menos duas contas.</p>
        ) : (
          <form
            action={
              mode === "expense" ? createExpenseAction : mode === "income" ? createIncomeAction : createTransferAction
            }
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {mode === "transfer" ? (
                <>
                  <label className={labelClassName}>
                    De
                    <select name="fromAccountId" required className={inputClassName}>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClassName}>
                    Para
                    <select name="toAccountId" required className={inputClassName}>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <label className={labelClassName}>
                  Conta
                  <select name="accountId" required className={inputClassName}>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {mode !== "transfer" ? (
                <label className={labelClassName}>
                  Categoria
                  <select
                    name="categoryId"
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                    className={inputClassName}
                  >
                    <option value="">Sem categoria</option>
                    {categoryOptions.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className={labelClassName}>
                Descrição
                <input
                  name="description"
                  required={mode !== "transfer"}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className={inputClassName}
                  placeholder={mode === "transfer" ? "Ex.: transferência para poupança" : "Ex.: CONTINENTE MODELO 0182"}
                />
              </label>
              <label className={labelClassName}>
                Montante (EUR)
                <input
                  name="amount"
                  required
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className={inputClassName}
                />
              </label>
              {mode !== "transfer" ? (
                <section className="rounded-2xl border border-blue-200/70 bg-blue-50/70 p-4 text-sm shadow-sm dark:border-blue-400/25 dark:bg-blue-500/10">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">✨ Categorização local</p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        Só a descrição, o montante e as categorias disponíveis são enviados ao Ollama no teu Mac.
                      </p>
                    </div>
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      disabled={suggestionPending || description.trim().length < 3 || !amount.trim()}
                      onClick={() => void requestSuggestion(true)}
                    >
                      {suggestionPending ? "A analisar…" : "Sugerir novamente"}
                    </button>
                  </div>
                  <div className="mt-3" aria-live="polite">
                    {suggestionPending ? (
                      <p className="text-slate-600 dark:text-slate-300">A analisar com o modelo local…</p>
                    ) : suggestion ? (
                      <div className="grid gap-2 rounded-xl border border-blue-200 bg-white/80 p-3 dark:border-blue-300/20 dark:bg-slate-950/35">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong>{suggestion.merchant}</strong>
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-400/15 dark:text-blue-200">
                            {Math.round(suggestion.confidence * 100)}% confiança
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-300">{suggestion.provider}</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-200">
                          {suggestion.categoryName ?? "Sem categoria"} · {suggestion.transactionType === "EXPENSE" ? "Despesa" : suggestion.transactionType === "INCOME" ? "Receita" : "Transferência"} · {suggestion.nature === "NECESSARY" ? "Essencial" : suggestion.nature === "DISCRETIONARY" ? "Não essencial" : "Natureza por rever"}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300">{suggestion.reason}</p>
                        {suggestion.tags.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {suggestion.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-200">#{tag}</span>)}
                          </div>
                        ) : null}
                        {suggestion.transactionType === "TRANSFER" ? (
                          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                            Parece uma transferência. Confirma manualmente no separador «Transferência»; o FinTwin não muda o tipo nem guarda nada sem a tua confirmação.
                          </p>
                        ) : null}
                      </div>
                    ) : suggestionError ? (
                      <p className="text-xs text-amber-700 dark:text-amber-300">{suggestionError}</p>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-300">
                        A sugestão aparece automaticamente depois de preencheres a descrição e o montante.
                      </p>
                    )}
                  </div>
                </section>
              ) : null}
              {suggestion ? (
                <>
                  <input type="hidden" name="aiMerchant" value={suggestion.merchant} />
                  <input type="hidden" name="aiSuggestedCategoryId" value={suggestion.categoryId ?? ""} />
                  <input type="hidden" name="aiSuggestionSource" value={suggestion.source} />
                </>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button type="button" className={secondaryButtonClassName} onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <SubmitButton label={submitLabel} />
            </div>
          </form>
        )}
      </SideDrawer>
    </>
  );
}
