"use client";

import { useOptimistic, useTransition } from "react";
import { secondaryButtonClassName } from "@/components/ui/form-styles";
import { markFinancialAlertSeenAction } from "@/lib/finance/financial-alert-actions";

export function MarkAlertSeenButton({
  alertId,
  initiallySeen,
}: {
  alertId: string;
  initiallySeen: boolean;
}) {
  const [, startTransition] = useTransition();
  const [seen, setSeen] = useOptimistic(initiallySeen, (_current, next: boolean) => next);

  if (seen) {
    return <p className="text-xs text-slate-500">Já visto por ti</p>;
  }

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          setSeen(true);
          await markFinancialAlertSeenAction(formData);
        });
      }}
    >
      <input type="hidden" name="alertId" value={alertId} />
      <button type="submit" className={`${secondaryButtonClassName} w-full`}>
        Marcar como visto
      </button>
    </form>
  );
}
