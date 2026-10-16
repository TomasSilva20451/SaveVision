"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { flashError, flashSuccess } from "@/lib/ui/action-feedback";
import { validatePaymentDueDayInput } from "@/lib/finance/liability-recurring-link";
import {
  createLiability,
  recordLiabilityPayment,
  updateLiabilitySchedule,
} from "@/server/services/patrimony";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

export async function createLiabilityAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const type = String(formData.get("type")) as
    | "PERSONAL_LOAN"
    | "AUTO_LOAN"
    | "MORTGAGE"
    | "FAMILY_LOAN"
    | "OTHER";

  const dueParsed = validatePaymentDueDayInput(formData.get("paymentDueDayOfMonth"));
  if (!dueParsed.ok) {
    await flashError(dueParsed.error);
    return;
  }

  const created = await createLiability(user.id, selected.id, {
    title: String(formData.get("title")),
    type,
    outstandingBalance: String(formData.get("outstandingBalance")),
    monthlyPayment: String(formData.get("monthlyPayment") || "") || undefined,
    paymentDueDayOfMonth: dueParsed.day,
    manualRatePercent: String(formData.get("manualRatePercent") || "") || undefined,
    notes: String(formData.get("notes") || "") || undefined,
  });

  if (!created) {
    await flashError("Não foi possível criar a responsabilidade.");
    return;
  }

  await flashSuccess("Responsabilidade registada.");
  revalidatePath("/patrimonio");
  revalidatePath("/dashboard");
  revalidatePath("/previsoes");
}

export async function updateLiabilityScheduleAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const dueParsed = validatePaymentDueDayInput(formData.get("paymentDueDayOfMonth"));
  if (!dueParsed.ok) {
    await flashError(dueParsed.error);
    return;
  }

  const clear = formData.get("clearDueDay") === "1";
  const updated = await updateLiabilitySchedule(user.id, selected.id, String(formData.get("liabilityId")), {
    paymentDueDayOfMonth: clear ? null : dueParsed.day,
  });

  if (!updated) {
    await flashError("Não foi possível atualizar o vencimento.");
    return;
  }

  await flashSuccess(
    clear
      ? "Dia de vencimento removido."
      : "Dia de vencimento atualizado. As previsões usarão esta data.",
  );
  revalidatePath("/patrimonio");
  revalidatePath("/previsoes");
}

export async function recordLiabilityPaymentAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const paidAtRaw = String(formData.get("paidAt") || "");
  const paidAt = paidAtRaw ? new Date(paidAtRaw) : new Date();

  const mode =
    formData.get("recordBankMovement") === "on" ? "WITH_BANK" : "LIABILITY_ONLY";

  const updated = await recordLiabilityPayment(user.id, selected.id, {
    liabilityId: String(formData.get("liabilityId")),
    paidAt,
    principalAmount: String(formData.get("principalAmount") || "0"),
    interestAmount: String(formData.get("interestAmount") || "0"),
    feesAmount: String(formData.get("feesAmount") || "0"),
    notes: String(formData.get("notes") || "") || undefined,
    mode,
    accountId: String(formData.get("accountId") || "") || undefined,
    idempotencyKey: String(formData.get("idempotencyKey") || "") || undefined,
    acknowledgeLinkedLiabilityRisk:
      formData.get("acknowledgeLinkedLiabilityRisk") === "on",
  });

  if (!updated.ok) {
    if (updated.reason === "linked_liability_ack_required" && updated.message) {
      await flashError(updated.message);
    } else {
      await flashError("Pagamento inválido ou responsabilidade inexistente.");
    }
    return;
  }

  await flashSuccess("Pagamento registado (capital reduz passivo; juros podem ser despesa à parte).");
  revalidatePath("/patrimonio");
  revalidatePath("/contas");
  revalidatePath("/transacoes");
  revalidatePath("/dashboard");
}

export async function captureNetWorthSnapshotAction(): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const { captureNetWorthSnapshot } = await import(
    "@/server/services/net-worth-snapshot"
  );
  const snapshot = await captureNetWorthSnapshot(user.id, selected.id);
  if (!snapshot) {
    await flashError("Não foi possível criar o snapshot.");
    return;
  }
  await flashSuccess("Snapshot patrimonial registado.");
  revalidatePath("/patrimonio");
}
