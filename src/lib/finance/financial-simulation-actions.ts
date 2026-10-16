"use server";

import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { civilDateIsoToInstant } from "@/lib/datetime/civil-date";
import {
  oneOffOutflowEvent,
  simulateTreasuryWithHypothetical,
} from "@/lib/finance/financial-simulation-forecast";
import { decimal } from "@/lib/finance/money";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";
import { loadTreasuryContext } from "@/server/services/treasury-forecast";

/** Simulação read-only — não escreve na BD. */
export async function simulateTreasuryOneOffAction(input: {
  amount: string;
  dueDateIso: string;
  label?: string;
}): Promise<
  | {
      ok: true;
      minProjectedBase: string | null;
      minProjectedAdjusted: string | null;
      projectedBalanceBase: string;
      projectedBalanceAdjusted: string;
    }
  | { ok: false; reason: string }
> {
  const user = await requireAuthenticatedUser();
  if (!user) return { ok: false, reason: "unauthenticated" };

  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return { ok: false, reason: "no_workspace" };

  const membership = await requireWorkspaceAccess(user.id, selected.id);
  if (!membership) return { ok: false, reason: "forbidden" };

  let amount: string;
  try {
    amount = decimal(input.amount.replace(",", ".")).toFixed(2);
    if (decimal(amount).lte(0)) return { ok: false, reason: "invalid_amount" };
  } catch {
    return { ok: false, reason: "invalid_amount" };
  }

  const ctx = await loadTreasuryContext(user.id, selected.id);
  if (!ctx) return { ok: false, reason: "no_treasury_context" };

  const dueDate = civilDateIsoToInstant(input.dueDateIso);
  const hypo = [
    oneOffOutflowEvent(
      `sim-oneoff-${Date.now()}`,
      input.label ?? "Despesa extraordinária (simulada)",
      amount,
      dueDate,
    ),
  ];

  const result = simulateTreasuryWithHypothetical({
    startingBalance: ctx.startingBalance,
    baseEvents: ctx.eventsMaxHorizon,
    hypotheticalEvents: hypo,
    horizonDays: 30,
    asOf: ctx.asOf,
  });

  return {
    ok: true,
    minProjectedBase: result.minProjectedBase,
    minProjectedAdjusted: result.minProjectedAdjusted,
    projectedBalanceBase: result.base.projectedBalance,
    projectedBalanceAdjusted: result.adjusted.projectedBalance,
  };
}
