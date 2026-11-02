"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/ui/form-styles";
import {
  civilDateFromInstant,
  formatCivilDateIso,
} from "@/lib/datetime/civil-date";
import {
  confirmRecurringExpenseAction,
  endRecurringExpenseAction,
  pauseRecurringExpenseAction,
  postponeRecurringExpenseAction,
  skipRecurringExpenseAction,
  updateRecurringAmountAction,
  updateRecurringLiabilityLinkAction,
} from "@/lib/finance/recurring-expense-actions";
import {
  paymentAccountLabel,
  sortPaymentAccounts,
} from "@/lib/finance/payment-account";

const MENU_WIDTH_PX = 320;
const VIEWPORT_PAD = 8;
const ANCHOR_GAP = 8;

type Occurrence = {
  id: string;
  expectedAmount: { toString(): string };
};

type Series = {
  id: string;
  name: string;
  status: string;
  expectedAmount: { toString(): string };
  linkedLiabilityId: string | null;
  accountId: string | null;
};

type MenuPlacement = {
  top: number;
  left: number;
  maxHeight: number;
};

function computeMenuPlacement(anchor: HTMLElement, menu: HTMLElement | null): MenuPlacement {
  const rect = anchor.getBoundingClientRect();
  let left = rect.right - MENU_WIDTH_PX;
  left = Math.max(
    VIEWPORT_PAD,
    Math.min(left, window.innerWidth - MENU_WIDTH_PX - VIEWPORT_PAD),
  );

  const spaceBelow = window.innerHeight - rect.bottom - ANCHOR_GAP - VIEWPORT_PAD;
  const spaceAbove = rect.top - ANCHOR_GAP - VIEWPORT_PAD;
  const measuredHeight = menu?.offsetHeight ?? 0;
  const preferredMax = Math.min(window.innerHeight * 0.7, 512);
  const openBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;

  if (openBelow) {
    return {
      top: rect.bottom + ANCHOR_GAP,
      left,
      maxHeight: Math.max(120, Math.min(preferredMax, spaceBelow)),
    };
  }

  const maxHeight = Math.max(120, Math.min(preferredMax, spaceAbove));
  const height = measuredHeight > 0 ? Math.min(measuredHeight, maxHeight) : maxHeight;
  return {
    top: Math.max(VIEWPORT_PAD, rect.top - ANCHOR_GAP - height),
    left,
    maxHeight,
  };
}

export function RecurringSeriesActionsMenu({
  series,
  nextOccurrence,
  accounts,
  liabilities,
  preferredAccountId,
  now,
}: {
  series: Series;
  nextOccurrence: Occurrence | null;
  accounts: { id: string; name: string; type: string }[];
  liabilities: { id: string; title: string }[];
  preferredAccountId: string;
  now: Date;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<MenuPlacement | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const paymentAccounts = sortPaymentAccounts(accounts);

  const closeMenu = () => {
    setOpen(false);
    setPlacement(null);
  };

  const toggleMenu = () => {
    if (open) {
      closeMenu();
      return;
    }
    const anchor = anchorRef.current;
    if (anchor) {
      setPlacement(computeMenuPlacement(anchor, null));
    }
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open) return;

    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      setPlacement(computeMenuPlacement(anchor, menuRef.current));
    };

    const frame = requestAnimationFrame(update);
    const menu = menuRef.current;
    const resizeObserver = menu ? new ResizeObserver(update) : null;
    if (menu && resizeObserver) resizeObserver.observe(menu);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, nextOccurrence?.id, series.status]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const menuPanel = open && placement ? (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      style={{
        position: "fixed",
        top: placement.top,
        left: placement.left,
        width: MENU_WIDTH_PX,
        maxWidth: "80vw",
        maxHeight: placement.maxHeight,
        zIndex: 60,
      }}
      className="space-y-3 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gerir recorrência</p>
      <div className="flex flex-wrap gap-2">
        {series.status !== "ENDED" ? (
          <form action={pauseRecurringExpenseAction} onSubmit={() => closeMenu()}>
            <input type="hidden" name="seriesId" value={series.id} />
            {series.status === "PAUSED" ? <input type="hidden" name="resume" value="1" /> : null}
            <button type="submit" className={secondaryButtonClassName}>
              {series.status === "PAUSED" ? "Retomar" : "Pausar"}
            </button>
          </form>
        ) : null}
        {series.status !== "ENDED" ? (
          <form action={endRecurringExpenseAction} onSubmit={() => closeMenu()}>
            <input type="hidden" name="seriesId" value={series.id} />
            <button type="submit" className={secondaryButtonClassName}>
              Terminar
            </button>
          </form>
        ) : null}
      </div>
      <form action={updateRecurringAmountAction} className="space-y-2 border-t border-[var(--border)] pt-3" onSubmit={() => closeMenu()}>
        <input type="hidden" name="seriesId" value={series.id} />
        <label className="block text-xs font-medium text-slate-600">
          Valor futuro
          <input
            name="expectedAmount"
            inputMode="decimal"
            defaultValue={series.expectedAmount.toString()}
            className={`${inputClassName} mt-1`}
          />
        </label>
        <button type="submit" className={secondaryButtonClassName}>
          Atualizar valor
        </button>
      </form>
      <form
        action={updateRecurringLiabilityLinkAction}
        className="space-y-2 border-t border-[var(--border)] pt-3"
        data-testid="recurring-liability-link-form"
        onSubmit={() => closeMenu()}
      >
        <input type="hidden" name="seriesId" value={series.id} />
        <label className="block text-xs font-medium text-slate-600">
          Passivo associado
          <select
            name="linkedLiabilityId"
            defaultValue={series.linkedLiabilityId ?? ""}
            className={`${inputClassName} mt-1`}
          >
            <option value="">— Nenhum —</option>
            {liabilities.map((liability) => (
              <option key={liability.id} value={liability.id}>
                {liability.title}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={secondaryButtonClassName}>
          Guardar associação
        </button>
      </form>
      {nextOccurrence && accounts.length > 0 ? (
        <div className="space-y-3 border-t border-[var(--border)] pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Próxima ocorrência</p>
          <form action={confirmRecurringExpenseAction} className="space-y-2" onSubmit={() => closeMenu()}>
            <input type="hidden" name="occurrenceId" value={nextOccurrence.id} />
            <input type="hidden" name="idempotencyKey" value={`pay-${nextOccurrence.id}`} />
            <input type="hidden" name="paidAt" value={now.toISOString()} />
            <select
              name="accountId"
              required
              defaultValue={preferredAccountId}
              aria-label="Conta do pagamento"
              className={`${inputClassName} mt-0`}
            >
              {paymentAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {paymentAccountLabel(account)}
                </option>
              ))}
            </select>
            <input
              name="actualAmount"
              inputMode="decimal"
              defaultValue={nextOccurrence.expectedAmount.toString()}
              aria-label="Valor pago"
              className={`${inputClassName} mt-0`}
            />
            {series.linkedLiabilityId ? (
              <label className="flex items-start gap-2 text-xs text-amber-800">
                <input type="checkbox" name="acknowledgeLinkedLiabilityRisk" className="mt-0.5" data-testid="ack-linked-liability-recurring" />
                Compreendo o risco de duplicar a saída se registar também o pagamento do passivo.
              </label>
            ) : null}
            <button type="submit" className={primaryButtonClassName}>
              Confirmar pagamento
            </button>
          </form>
          <form action={postponeRecurringExpenseAction} className="flex items-end gap-2" onSubmit={() => closeMenu()}>
            <input type="hidden" name="occurrenceId" value={nextOccurrence.id} />
            <input
              name="newDueDate"
              type="date"
              required
              min={formatCivilDateIso(civilDateFromInstant(now))}
              aria-label="Nova data"
              className={`${inputClassName} mt-0 min-w-0`}
            />
            <button type="submit" className={secondaryButtonClassName}>
              Adiar
            </button>
          </form>
          <form action={skipRecurringExpenseAction} onSubmit={() => closeMenu()}>
            <input type="hidden" name="occurrenceId" value={nextOccurrence.id} />
            <button type="submit" className="text-sm font-medium text-rose-700 hover:underline">
              Ignorar ocorrência
            </button>
          </form>
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <div ref={anchorRef}>
      <button
        type="button"
        className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-lg text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        aria-label={`Ações de ${series.name}`}
        onClick={toggleMenu}
      >
        ⋮
      </button>
      {menuPanel ? createPortal(menuPanel, document.body) : null}
    </div>
  );
}
