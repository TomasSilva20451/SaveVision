"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { civilDateIsoToInstant } from "@/lib/datetime/civil-date";
import { normalizeDecimalInput } from "@/lib/finance/money";
import { RECEIPT_DUPLICATE_HIGH_SCORE } from "@/lib/finance/receipt-expense-match";
import { extractReceiptFromImage } from "@/server/services/receipt-extraction";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";
import { createExpense } from "@/server/services/expenses";
import { db } from "@/lib/db";
import { flashError, flashSuccess } from "@/lib/ui/action-feedback";

const EXPENSE_PATH = "/despesas";

export type ReceiptExtractActionResult =
  | {
      ok: true;
      result: NonNullable<Awaited<ReturnType<typeof extractReceiptFromImage>>>;
    }
  | { ok: false; error: string };

export async function extractReceiptAction(formData: FormData): Promise<ReceiptExtractActionResult> {
  const user = await requireAuthenticatedUser();
  if (!user) return { ok: false, error: "Inicia sessão para digitalizar recibos." };
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return { ok: false, error: "Seleciona primeiro um workspace." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Escolhe uma fotografia ou imagem do recibo." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const result = await extractReceiptFromImage(user.id, selected.id, {
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      bytes,
    });
    if (!result) {
      return { ok: false, error: "Não tens permissão para registar despesas neste workspace." };
    }
    return { ok: true, result };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "UNSUPPORTED_IMAGE") {
      return { ok: false, error: "Só JPEG e PNG são suportados nesta versão." };
    }
    if (code === "IMAGE_TOO_SMALL") {
      return { ok: false, error: "A imagem é demasiado pequena para analisar." };
    }
    if (code === "UPLOAD_REJECTED") {
      return { ok: false, error: "Não foi possível guardar o recibo em armazenamento privado." };
    }
    if (code === "OLLAMA_REMOTE_DISABLED") {
      return { ok: false, error: "Por segurança, o FinTwin só permite o Ollama local." };
    }
    if (code === "OLLAMA_NO_RECEIPT_MODEL") {
      return {
        ok: false,
        error: "Nenhum modelo de visão respondeu. Verifica moondream:latest e qwen3.5:4b-mlx no Ollama.",
      };
    }
    if (code.startsWith("OLLAMA_")) {
      return {
        ok: false,
        error:
          "O Moondream local não respondeu. Confirma ollama pull moondream:latest e OLLAMA_BASE_URL.",
      };
    }
    return { ok: false, error: "Não foi possível analisar o recibo. Tenta outra fotografia." };
  }
}

export async function createExpenseFromReceiptAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const receiptDocumentId = String(formData.get("receiptDocumentId") ?? "").trim();
  const acknowledged = formData.get("receiptReviewAcknowledged") === "yes";
  const duplicateAck = formData.get("receiptDuplicateAcknowledged") === "yes";
  const duplicateScore = Number(formData.get("receiptDuplicateScore") ?? "0");
  if (receiptDocumentId && !acknowledged) {
    await flashError("Confirma que reviste o total e os dados do recibo antes de registar.", EXPENSE_PATH);
    return;
  }
  if (duplicateScore >= RECEIPT_DUPLICATE_HIGH_SCORE && !duplicateAck) {
    await flashError(
      "Existe uma despesa semelhante. Confirma que não é duplicado antes de registar.",
      EXPENSE_PATH,
    );
    return;
  }

  if (receiptDocumentId) {
    const doc = await db.storedDocument.findFirst({
      where: { id: receiptDocumentId, workspaceId: selected.id },
    });
    if (!doc) {
      await flashError("O recibo associado já não está disponível neste workspace.", EXPENSE_PATH);
      return;
    }
  }

  let amount: string;
  let occurredAt: Date;
  try {
    amount = normalizeDecimalInput(String(formData.get("amount")));
    occurredAt = civilDateIsoToInstant(String(formData.get("occurredAt")));
  } catch {
    await flashError("Montante ou data inválidos.", EXPENSE_PATH);
    return;
  }

  const created = await createExpense(user.id, selected.id, {
    accountId: String(formData.get("accountId")),
    amount,
    description: String(formData.get("description")),
    categoryId: String(formData.get("categoryId") || "") || undefined,
    occurredAt,
  });

  if (!created) {
    await flashError("Não foi possível registar a despesa. Verifica a conta e o montante.", EXPENSE_PATH);
    return;
  }

  await flashSuccess(
    receiptDocumentId
      ? "Despesa registada. O recibo permanece nos documentos privados do workspace."
      : "Despesa registada.",
    EXPENSE_PATH,
  );

  revalidatePath("/despesas");
  revalidatePath("/transacoes");
  revalidatePath("/contas");
  revalidatePath("/orcamentos");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
}
