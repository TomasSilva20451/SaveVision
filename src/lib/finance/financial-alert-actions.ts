"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { flashError, flashSuccess } from "@/lib/ui/action-feedback";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";
import {
  dismissFinancialAlert,
  evaluateAndSyncFinancialAlerts,
  markAllFinancialAlertsSeen,
  markFinancialAlertSeen,
} from "@/server/services/financial-alerts";

export async function syncFinancialAlertsAction(): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  await evaluateAndSyncFinancialAlerts(user.id, selected.id);
  revalidatePath("/alertas");
  revalidatePath("/dashboard");
}

export async function markFinancialAlertSeenAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const ok = await markFinancialAlertSeen(
    user.id,
    selected.id,
    String(formData.get("alertId")),
  );
  if (!ok) {
    await flashError("Alerta não encontrado.");
    return;
  }
  revalidatePath("/alertas");
  revalidatePath("/dashboard");
}

export async function dismissFinancialAlertAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const ok = await dismissFinancialAlert(
    user.id,
    selected.id,
    String(formData.get("alertId")),
  );
  if (!ok) {
    await flashError("Alerta não encontrado.");
    return;
  }
  await flashSuccess("Alerta dispensado na tua lista.");
  revalidatePath("/alertas");
  revalidatePath("/dashboard");
}

export async function markAllFinancialAlertsSeenAction(): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  await markAllFinancialAlertsSeen(user.id, selected.id);
  revalidatePath("/alertas");
  revalidatePath("/dashboard");
}
