"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { flashError, flashSuccess } from "@/lib/ui/action-feedback";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";
import {
  confirmRecurringExpenseOccurrence,
  createRecurringExpense,
  postponeExpenseOccurrence,
  restoreRecurringExpenseOccurrence,
  setRecurringExpenseStatus,
  skipExpenseOccurrence,
  setRecurringLiabilityLink,
  updateRecurringExpenseFutureAmount,
} from "@/server/services/recurring-expenses";
import { civilDateIsoToInstant } from "@/lib/datetime/civil-date";
import type { RecurrenceFrequency } from "@/lib/finance/recurring-schedule";
import {
  blockRecurringPatternMerchant,
  createRecurringExpenseFromPatternSuggestion,
  dismissRecurringPatternSuggestion,
} from "@/server/services/recurring-pattern-suggestions";

const RECURRING_PATH = "/despesas-recorrentes";

async function recurringSuccess(text: string) {
  await flashSuccess(text, RECURRING_PATH);
}

async function recurringError(text: string) {
  await flashError(text, RECURRING_PATH);
}

async function workspaceOrAbort(userId: string) {
  return resolveWorkspaceContext(userId);
}

export async function createRecurringExpenseAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await workspaceOrAbort(user.id);
  if (!selected) return;

  const accountRaw = String(formData.get("accountId") ?? "");
  const endRaw = String(formData.get("endDate") ?? "");

  const created = await createRecurringExpense(user.id, selected.id, {
    name: String(formData.get("name")),
    description: String(formData.get("description") ?? "") || undefined,
    categoryId: String(formData.get("categoryId")),
    expectedAmount: String(formData.get("expectedAmount")),
    frequency: String(formData.get("frequency")) as RecurrenceFrequency,
    startDate: civilDateIsoToInstant(String(formData.get("startDate"))),
    endDate: endRaw ? civilDateIsoToInstant(endRaw) : undefined,
    dueDayOfMonth: formData.get("dueDayOfMonth")
      ? Number(formData.get("dueDayOfMonth"))
      : undefined,
    accountId: accountRaw || undefined,
    linkedLiabilityId: String(formData.get("linkedLiabilityId") ?? "") || null,
  });

  if (!created) {
    await recurringError("Não foi possível criar a recorrência. Verifica categoria e montante.");
    return;
  }
  await recurringSuccess("Despesa recorrente criada.");
  revalidatePath("/despesas-recorrentes");
  revalidatePath("/dashboard");
  revalidatePath("/previsoes");
}

export async function updateRecurringLiabilityLinkAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await workspaceOrAbort(user.id);
  if (!selected) return;

  const raw = String(formData.get("linkedLiabilityId") ?? "");
  const linkedLiabilityId = raw === "" ? null : raw;

  const result = await setRecurringLiabilityLink(
    user.id,
    selected.id,
    String(formData.get("seriesId")),
    linkedLiabilityId,
  );

  if (!result.ok) {
    await recurringError(result.error);
    return;
  }

  await recurringSuccess(
    linkedLiabilityId
      ? "Associação ao passivo guardada. A previsão evita dupla contagem."
      : "Associação ao passivo removida.",
  );
  revalidatePath("/despesas-recorrentes");
  revalidatePath("/previsoes");
}

export async function confirmRecurringExpenseAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await workspaceOrAbort(user.id);
  if (!selected) return;

  const idempotencyKey = String(formData.get("idempotencyKey") ?? "") || undefined;

  const result = await confirmRecurringExpenseOccurrence(user.id, selected.id, {
    occurrenceId: String(formData.get("occurrenceId")),
    accountId: String(formData.get("accountId")),
    actualAmount: String(formData.get("actualAmount")),
    paidAt: new Date(String(formData.get("paidAt") ?? new Date().toISOString())),
    idempotencyKey,
    acknowledgeLinkedLiabilityRisk:
      formData.get("acknowledgeLinkedLiabilityRisk") === "on",
  });

  if (!result.ok) {
    if (result.reason === "linked_liability_ack_required" && "message" in result) {
      await recurringError(result.message);
    } else {
      await recurringError("Confirmação falhou. Verifica conta, montante e estado da ocorrência.");
    }
    return;
  }
  await recurringSuccess(
    result.alreadyConfirmed ? "Pagamento já estava confirmado." : "Pagamento confirmado.",
  );
  revalidatePath("/despesas-recorrentes");
  revalidatePath("/dashboard");
  revalidatePath("/contas");
  revalidatePath("/despesas");
}

export async function postponeRecurringExpenseAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await workspaceOrAbort(user.id);
  if (!selected) return;

  const ok = await postponeExpenseOccurrence(
    user.id,
    selected.id,
    String(formData.get("occurrenceId")),
    civilDateIsoToInstant(String(formData.get("newDueDate"))),
  );
  if (!ok) {
    await recurringError("Não foi possível adiar a ocorrência.");
    return;
  }
  await recurringSuccess("Vencimento adiado.");
  revalidatePath("/despesas-recorrentes");
}

export async function skipRecurringExpenseAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await workspaceOrAbort(user.id);
  if (!selected) return;

  const ok = await skipExpenseOccurrence(
    user.id,
    selected.id,
    String(formData.get("occurrenceId")),
  );
  if (!ok) {
    await recurringError("Não foi possível ignorar a ocorrência.");
    return;
  }
  await recurringSuccess("Ocorrência ignorada.");
  revalidatePath("/despesas-recorrentes");
}

export async function pauseRecurringExpenseAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await workspaceOrAbort(user.id);
  if (!selected) return;

  const status = formData.get("resume") ? "ACTIVE" : "PAUSED";
  const ok = await setRecurringExpenseStatus(
    user.id,
    selected.id,
    String(formData.get("seriesId")),
    status,
  );
  if (!ok) {
    await recurringError("Não foi possível alterar o estado da recorrência.");
    return;
  }
  await recurringSuccess(status === "PAUSED" ? "Recorrência pausada." : "Recorrência retomada.");
  revalidatePath("/despesas-recorrentes");
}

export async function endRecurringExpenseAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await workspaceOrAbort(user.id);
  if (!selected) return;

  const ok = await setRecurringExpenseStatus(
    user.id,
    selected.id,
    String(formData.get("seriesId")),
    "ENDED",
  );
  if (!ok) {
    await recurringError("Não foi possível terminar a recorrência.");
    return;
  }
  await recurringSuccess("Recorrência terminada.");
  revalidatePath("/despesas-recorrentes");
}

export async function updateRecurringAmountAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await workspaceOrAbort(user.id);
  if (!selected) return;

  const ok = await updateRecurringExpenseFutureAmount(
    user.id,
    selected.id,
    String(formData.get("seriesId")),
    String(formData.get("expectedAmount")),
  );
  if (!ok) {
    await recurringError("Não foi possível atualizar o valor futuro.");
    return;
  }
  await recurringSuccess("Valor futuro atualizado (histórico pago preservado).");
  revalidatePath("/despesas-recorrentes");
}

export async function restoreRecurringExpenseOccurrenceAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await workspaceOrAbort(user.id);
  if (!selected) return;

  const result = await restoreRecurringExpenseOccurrence(
    user.id,
    selected.id,
    String(formData.get("occurrenceId") ?? ""),
  );
  if (!result.ok) {
    await recurringError(result.error);
    return;
  }

  const message = result.restoredFrom === "PAID"
    ? `Pagamento anulado${result.accountName ? `; o saldo foi reposto em «${result.accountName}»` : ""}.`
    : "Ocorrência ignorada reposta como pendente.";
  await recurringSuccess(message);
  revalidatePath("/despesas-recorrentes");
  revalidatePath("/dashboard");
  revalidatePath("/contas");
  revalidatePath("/despesas");
  revalidatePath("/transacoes");
  revalidatePath("/previsoes");
  revalidatePath("/analises");
}

export async function dismissRecurringPatternSuggestionAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await workspaceOrAbort(user.id);
  if (!selected) return;

  const ok = await dismissRecurringPatternSuggestion(user.id, selected.id, {
    suggestionKey: String(formData.get("suggestionKey") ?? ""),
    merchantPattern: String(formData.get("merchantPattern") ?? ""),
  });
  if (!ok) {
    await recurringError("Não foi possível ignorar a sugestão.");
    return;
  }
  await recurringSuccess("Sugestão ignorada.");
  revalidatePath("/despesas-recorrentes");
}

export async function blockRecurringPatternMerchantAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await workspaceOrAbort(user.id);
  if (!selected) return;

  const merchantPattern = String(formData.get("merchantPattern") ?? "");
  const ok = await blockRecurringPatternMerchant(user.id, selected.id, merchantPattern);
  if (!ok) {
    await recurringError("Não foi possível bloquear este comerciante.");
    return;
  }
  await recurringSuccess("Este comerciante deixará de ser sugerido neste workspace.");
  revalidatePath("/despesas-recorrentes");
}

export async function acceptRecurringPatternSuggestionAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await workspaceOrAbort(user.id);
  if (!selected) return;

  const transactionIds = String(formData.get("transactionIds") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const accountRaw = String(formData.get("accountId") ?? "");

  const result = await createRecurringExpenseFromPatternSuggestion(user.id, selected.id, {
    suggestionKey: String(formData.get("suggestionKey") ?? ""),
    name: String(formData.get("name") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    accountId: accountRaw || undefined,
    transactionIds,
  });

  if (!result.ok) {
    const message =
      result.reason === "DUPLICATE"
        ? "Já existe uma recorrência semelhante. Revê a lista antes de confirmar."
        : result.reason === "EVIDENCE_CHANGED"
          ? "Os movimentos de evidência mudaram. Atualiza a página e revê a sugestão."
          : "Não foi possível criar a recorrência a partir da sugestão.";
    await recurringError(message);
    return;
  }

  await recurringSuccess("Despesa recorrente criada a partir da sugestão.");
  revalidatePath("/despesas-recorrentes");
  revalidatePath("/dashboard");
  revalidatePath("/previsoes");
}
