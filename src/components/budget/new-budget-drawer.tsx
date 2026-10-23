"use client";

import { useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { upsertBudgetLineAction } from "@/lib/finance/budget-actions";
import {
  inputClassName,
  labelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/ui/form-styles";
import { SideDrawer } from "@/components/ui/side-drawer";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={primaryButtonClassName} disabled={pending} aria-busy={pending}>
      {pending ? "A guardar…" : "Guardar limite"}
    </button>
  );
}

export function NewBudgetDrawer({
  year,
  month,
  categories,
}: {
  year: number;
  month: number;
  categories: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button ref={triggerRef} type="button" className={primaryButtonClassName} onClick={() => setOpen(true)}>
        + Novo orçamento
      </button>
      <SideDrawer open={open} onClose={() => setOpen(false)} titleId={titleId} returnFocusRef={triggerRef}>
        <form action={upsertBudgetLineAction} className="flex h-full min-h-0 flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
            <div>
              <h2 id={titleId} className="text-lg font-semibold">
                Novo orçamento
              </h2>
              <p className="mt-1 text-sm text-slate-500">Define um limite mensal por categoria.</p>
            </div>
            <button type="button" className={secondaryButtonClassName} onClick={() => setOpen(false)}>
              Fechar
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
            <input type="hidden" name="year" value={year} />
            <input type="hidden" name="month" value={month} />
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
              Limite (EUR)
              <input name="limitAmount" required inputMode="decimal" className={inputClassName} />
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
