"use client";

import { useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createRecurringExpenseAction } from "@/lib/finance/recurring-expense-actions";
import {
  inputClassName,
  labelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/ui/form-styles";
import { SideDrawer } from "@/components/ui/side-drawer";
import {
  paymentAccountLabel,
  preferredPaymentAccountId,
  sortPaymentAccounts,
} from "@/lib/finance/payment-account";

const FREQUENCY_LABEL: Record<string, string> = {
  WEEKLY: "Semanal",
  BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  YEARLY: "Anual",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={primaryButtonClassName} disabled={pending} aria-busy={pending}>
      {pending ? "A guardar…" : "Criar recorrência"}
    </button>
  );
}

export function NewRecurringDrawer({
  todayIso,
  categories,
  accounts,
  liabilities,
}: {
  todayIso: string;
  categories: { id: string; name: string }[];
  accounts: { id: string; name: string; type: string }[];
  liabilities: { id: string; title: string }[];
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const paymentAccounts = sortPaymentAccounts(accounts);
  const preferredAccountId = preferredPaymentAccountId(paymentAccounts);

  return (
    <>
      <button ref={triggerRef} type="button" className={primaryButtonClassName} onClick={() => setOpen(true)}>
        + Nova despesa recorrente
      </button>
      <SideDrawer open={open} onClose={() => setOpen(false)} titleId={titleId} returnFocusRef={triggerRef}>
        <form action={createRecurringExpenseAction} className="flex h-full min-h-0 flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
            <div>
              <h2 id={titleId} className="text-lg font-semibold">
                Nova despesa recorrente
              </h2>
              <p className="mt-1 text-sm text-slate-500">O valor contratual gera ocorrências previstas. Não altera o saldo até confirmares o pagamento.</p>
            </div>
            <button type="button" className={secondaryButtonClassName} onClick={() => setOpen(false)}>
              Fechar
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
            <label className={labelClassName}>
              Nome
              <input name="name" required className={inputClassName} placeholder="Internet" />
            </label>
            <label className={labelClassName}>
              Categoria
              <select name="categoryId" required className={inputClassName}>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Valor previsto (EUR)
              <input name="expectedAmount" required inputMode="decimal" className={inputClassName} />
            </label>
            <label className={labelClassName}>
              Periodicidade
              <select name="frequency" required className={inputClassName} defaultValue="MONTHLY">
                {Object.entries(FREQUENCY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Início
              <input name="startDate" type="date" required defaultValue={todayIso} className={inputClassName} />
            </label>
            <label className={labelClassName}>
              Fim (opcional)
              <input name="endDate" type="date" className={inputClassName} />
            </label>
            <label className={labelClassName}>
              Dia do mês (mensal+)
              <input name="dueDayOfMonth" type="number" min={1} max={31} className={inputClassName} />
            </label>
            <label className={labelClassName}>
              Conta predefinida (opcional)
              <select name="accountId" className={inputClassName} defaultValue={preferredAccountId}>
                <option value="">—</option>
                {paymentAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {paymentAccountLabel(account)}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-slate-500">Por segurança, uma conta à ordem é escolhida antes de qualquer conta de poupança.</span>
            </label>
            <label className={labelClassName}>
              Associar a empréstimo/passivo (opcional)
              <select name="linkedLiabilityId" className={inputClassName} data-testid="recurring-liability-link-create">
                <option value="">— Nenhum —</option>
                {liabilities.map((liability) => (
                  <option key={liability.id} value={liability.id}>
                    {liability.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
            <button type="button" className={secondaryButtonClassName} onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <SubmitButton />
          </div>
        </form>
      </SideDrawer>
    </>
  );
}
