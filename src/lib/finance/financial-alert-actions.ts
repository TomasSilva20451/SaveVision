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

const ALERTS_PATH = "/alertas";

export async function syncFinancialAlertsAction(): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  try {
    const count = await evaluateAndSyncFinancialAlerts(user.id, selected.id);
    await flashSuccess(`${count} alerta${count === 1 ? "" : "s"} ativo${count === 1 ? "" : "s"} após a atualização.`, ALERTS_PATH);
  } catch {
    await flashError("Não foi possível atualizar os alertas.", ALERTS_PATH);
    return;
  }
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
    await flashError("Alerta não encontrado.", ALERTS_PATH);
    return;
  }
  await flashSuccess("Alerta marcado como visto para ti.", ALERTS_PATH);
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
    await flashError("Alerta não encontrado.", ALERTS_PATH);
    return;
  }
  await flashSuccess("Alerta dispensado na tua lista.", ALERTS_PATH);
  revalidatePath("/alertas");
  revalidatePath("/dashboard");
}

export async function markAllFinancialAlertsSeenAction(): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const count = await markAllFinancialAlertsSeen(user.id, selected.id);
  await flashSuccess(`${count} alerta${count === 1 ? "" : "s"} marcado${count === 1 ? "" : "s"} como visto${count === 1 ? "" : "s"}.`, ALERTS_PATH);
  revalidatePath("/alertas");
  revalidatePath("/dashboard");
}
