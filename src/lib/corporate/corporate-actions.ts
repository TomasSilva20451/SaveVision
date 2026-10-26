"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { flashError, flashSuccess } from "@/lib/ui/action-feedback";
import {
  confirmManualReconciliationMatch,
  importBankFeedCsv,
  registerOpenBankingConsent,
  runAutoReconciliation,
  syncOpenBankingFeed,
} from "@/server/services/bank-reconciliation";
import {
  createWebhookSubscription,
  openSupportCase,
  requestFinancialApproval,
  reviewFinancialApproval,
} from "@/server/services/corporate-finance";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

export async function importBankFeedAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const accountId = String(formData.get("accountId") ?? "");
  const csvText = String(formData.get("csvText") ?? "");
  if (!accountId || !csvText.trim()) {
    await flashError("Indica a conta e o CSV do extrato.");
    return;
  }

  const result = await importBankFeedCsv(user.id, selected.id, { accountId, csvText });
  if (!result) {
    await flashError("Importação recusada.");
    return;
  }
  await flashSuccess(`Importadas ${result.imported} linhas (${result.duplicates} duplicadas).`);
  revalidatePath("/reconciliacao");
}

export async function runAutoReconcileAction(): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const result = await runAutoReconciliation(user.id, selected.id);
  if (!result) {
    await flashError("Reconciliação automática indisponível.");
    return;
  }
  await flashSuccess(`Emparelhados ${result.matched} movimentos.`);
  revalidatePath("/reconciliacao");
}

export async function manualReconcileAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const bankFeedLineId = String(formData.get("bankFeedLineId") ?? "");
  const transactionId = String(formData.get("transactionId") ?? "");
  const result = await confirmManualReconciliationMatch(user.id, selected.id, {
    bankFeedLineId,
    transactionId,
  });
  if (!result?.ok) {
    await flashError("Não foi possível confirmar o par (conta ou montante incompatível).");
    return;
  }
  await flashSuccess("Reconciliação manual confirmada.");
  revalidatePath("/reconciliacao");
}

export async function syncOpenBankingAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const consentId = String(formData.get("consentId") ?? "");
  const result = await syncOpenBankingFeed(user.id, selected.id, { consentId });
  if (!result?.ok) {
    await flashError("Sincronização Open Banking indisponível.");
    return;
  }
  await flashSuccess(`Sincronizadas ${result.imported} linhas do extrato.`);
  revalidatePath("/open-banking");
  revalidatePath("/reconciliacao");
}

export async function registerConsentAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const parsed = z
    .object({
      accountId: z.string().min(1),
      provider: z.string().min(1),
      consentRef: z.string().min(1),
    })
    .safeParse({
      accountId: formData.get("accountId"),
      provider: formData.get("provider"),
      consentRef: formData.get("consentRef"),
    });
  if (!parsed.success) {
    await flashError("Dados de consentimento inválidos.");
    return;
  }

  const consent = await registerOpenBankingConsent(user.id, selected.id, parsed.data);
  if (!consent) {
    await flashError("Não foi possível registar o consentimento.");
    return;
  }
  await flashSuccess("Consentimento read-only registado.");
  revalidatePath("/open-banking");
}

export async function requestApprovalAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const actionType = String(formData.get("actionType") ?? "TRANSFER");
  const entityId = String(formData.get("entityId") ?? "pending");
  const note = String(formData.get("note") ?? "");

  const approval = await requestFinancialApproval(user.id, selected.id, {
    actionType,
    entityType: "ManualRequest",
    entityId,
    payload: { note },
  });
  if (!approval) {
    await flashError("Pedido de aprovação recusado.");
    return;
  }
  await flashSuccess("Pedido enviado para revisão.");
  revalidatePath("/empresa/aprovacoes");
}

export async function reviewApprovalAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const approvalId = String(formData.get("approvalId") ?? "");
  const decision = formData.get("decision") === "REJECTED" ? "REJECTED" : "APPROVED";
  const result = await reviewFinancialApproval(user.id, selected.id, { approvalId, decision });
  if (!result?.ok) {
    await flashError("Revisão recusada (maker-checker ou permissões).");
    return;
  }
  await flashSuccess(decision === "APPROVED" ? "Aprovação concedida." : "Pedido rejeitado.");
  revalidatePath("/empresa/aprovacoes");
}

export async function createWebhookAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const url = String(formData.get("url") ?? "");
  const eventsRaw = String(formData.get("events") ?? "reconciliation.matched");
  const events = eventsRaw.split(",").map((e) => e.trim()).filter(Boolean);
  const result = await createWebhookSubscription(user.id, selected.id, { url, events });
  if (!result) {
    await flashError("Webhook não criado.");
    return;
  }
  await flashSuccess(`Webhook criado. Guarda o segredo: ${result.secretOnce}`);
  revalidatePath("/empresa/webhooks");
}

export async function openSupportCaseAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const subject = String(formData.get("subject") ?? "").trim();
  if (!subject) {
    await flashError("Indica o assunto.");
    return;
  }
  const supportCase = await openSupportCase(user.id, selected.id, {
    subject,
    disputeRef: String(formData.get("disputeRef") ?? "") || undefined,
  });
  if (!supportCase) {
    await flashError("Caso não aberto.");
    return;
  }
  await flashSuccess("Caso registado.");
  revalidatePath("/empresa/casos");
}
