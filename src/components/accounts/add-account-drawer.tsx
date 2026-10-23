"use client";

import { useId, useRef, useState } from "react";
import { createAccountAction } from "@/lib/finance/actions";
import { inputClassName, labelClassName, primaryButtonClassName, secondaryButtonClassName } from "@/components/ui/form-styles";
import { SideDrawer } from "@/components/ui/side-drawer";

export function AddAccountDrawer() {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button ref={triggerRef} type="button" className={primaryButtonClassName} onClick={() => setOpen(true)}>
        + Adicionar conta
      </button>
      <SideDrawer open={open} onClose={() => setOpen(false)} titleId={titleId} returnFocusRef={triggerRef}>
        <form action={createAccountAction} className="flex h-full min-h-0 flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
            <div>
              <h2 id={titleId} className="text-lg font-semibold">
                Nova conta
              </h2>
              <p className="mt-1 text-sm text-slate-500">O saldo inicial entra no livro do workspace.</p>
            </div>
            <button type="button" className={secondaryButtonClassName} onClick={() => setOpen(false)}>
              Fechar
            </button>
          </div>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
            <label className={labelClassName}>
              Nome
              <input name="name" required className={inputClassName} autoFocus />
            </label>
            <label className={labelClassName}>
              Tipo
              <select name="type" className={inputClassName} defaultValue="CURRENT">
                <option value="CURRENT">Conta à ordem</option>
                <option value="SAVINGS">Poupança</option>
                <option value="CASH">Dinheiro</option>
                <option value="INVESTMENT">Investimento</option>
                <option value="OTHER">Outra</option>
              </select>
            </label>
            <label className={labelClassName}>
              Instituição
              <input name="institution" className={inputClassName} placeholder="Opcional" />
            </label>
            <label className={labelClassName}>
              Saldo inicial (EUR)
              <input name="openingBalance" defaultValue="0" required inputMode="decimal" className={inputClassName} />
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
            <button type="button" className={secondaryButtonClassName} onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className={primaryButtonClassName}>
              Criar conta
            </button>
          </div>
        </form>
      </SideDrawer>
    </>
  );
}
