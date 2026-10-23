"use client";

import { useFormStatus } from "react-dom";
import {
  acceptRecurringPatternSuggestionAction,
  blockRecurringPatternMerchantAction,
  dismissRecurringPatternSuggestionAction,
} from "@/lib/finance/recurring-expense-actions";
import { formatEUR } from "@/lib/finance/money";
import {
  inputClassName,
  labelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/ui/form-styles";
import type { RecurringPatternSuggestionView } from "@/server/services/recurring-pattern-suggestions";

function PendingButton({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? "A processar…" : label}
    </button>
  );
}

export function RecurringPatternSuggestions({
  suggestions,
  categories,
  accounts,
}: {
  suggestions: RecurringPatternSuggestionView[];
  categories: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
}) {
  if (suggestions.length === 0) return null;

  return (
    <section className="mt-5 rounded-2xl border border-violet-200/80 bg-violet-50/60 p-5 shadow-sm dark:border-violet-400/25 dark:bg-violet-500/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
            Possíveis despesas recorrentes
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            O motor estatístico analisa intervalos e montantes; o modelo local só interpreta a descrição. Nada é criado
            automaticamente.
          </p>
        </div>
        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800 dark:bg-violet-400/15 dark:text-violet-100">
          {suggestions.length} sugestão{suggestions.length === 1 ? "" : "ões"}
        </span>
      </div>

      <ul className="mt-4 flex flex-col gap-4">
        {suggestions.map((suggestion) => {
          const defaultCategory =
            suggestion.dominantCategoryId &&
            categories.some((category) => category.id === suggestion.dominantCategoryId)
              ? suggestion.dominantCategoryId
              : categories[0]?.id;
          const defaultAccount =
            suggestion.dominantAccountId &&
            accounts.some((account) => account.id === suggestion.dominantAccountId)
              ? suggestion.dominantAccountId
              : accounts[0]?.id ?? "";

          return (
            <li
              key={suggestion.suggestionKey}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{suggestion.title}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{suggestion.summary}</p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {suggestion.frequencyLabel} · ~{formatEUR(suggestion.expectedAmount)} ·{" "}
                    {Math.round(suggestion.confidence * 100)}% confiança · {suggestion.enrichedBy === "OLLAMA" ? "interpretação local" : "apenas regras"}
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Movimentos analisados</p>
                <ul className="mt-2 flex flex-col gap-1.5 text-sm text-slate-700 dark:text-slate-200">
                  {suggestion.evidence.map((item) => (
                    <li key={item.id} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/40">
                      <span className="font-medium">{item.occurredAt.split("-").reverse().join("/")}</span> ·{" "}
                      {formatEUR(item.amount)} · {item.description}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <form action={acceptRecurringPatternSuggestionAction} className="flex min-w-[min(100%,20rem)] flex-1 flex-col gap-3 rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-3 dark:border-emerald-400/20 dark:bg-emerald-500/5">
                  <input type="hidden" name="suggestionKey" value={suggestion.suggestionKey} />
                  <input type="hidden" name="transactionIds" value={suggestion.transactionIds.join(",")} />
                  <label className={labelClassName}>
                    Nome da recorrência
                    <input name="name" required defaultValue={suggestion.title} className={inputClassName} />
                  </label>
                  <label className={labelClassName}>
                    Categoria
                    <select name="categoryId" required defaultValue={defaultCategory} className={inputClassName}>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {accounts.length ? (
                    <label className={labelClassName}>
                      Conta predefinida
                      <select name="accountId" defaultValue={defaultAccount} className={inputClassName}>
                        <option value="">Sem conta predefinida</option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <PendingButton label="Adicionar às despesas recorrentes" className={primaryButtonClassName} />
                </form>

                <div className="flex flex-col gap-2">
                  <form action={dismissRecurringPatternSuggestionAction}>
                    <input type="hidden" name="suggestionKey" value={suggestion.suggestionKey} />
                    <input type="hidden" name="merchantPattern" value={suggestion.merchantPattern} />
                    <PendingButton label="Ignorar esta sugestão" className={secondaryButtonClassName} />
                  </form>
                  <form action={blockRecurringPatternMerchantAction}>
                    <input type="hidden" name="merchantPattern" value={suggestion.merchantPattern} />
                    <PendingButton label="Não voltar a sugerir este comerciante" className={secondaryButtonClassName} />
                  </form>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
