"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";
import {
  confirmIncomeOccurrence,
  confirmOneOffExpectedIncome,
  createEcommerceSaleRecord,
  createFamilyIncomeSeries,
  createOneOffIncome,
  createTournamentIncomeRecord,
} from "@/server/services/income";
import { flashError, flashSuccess } from "@/lib/ui/action-feedback";
import { readReturnTo } from "@/lib/ui/form-return";
import { createExpense } from "@/server/services/expenses";
import { civilDateIsoToInstant } from "@/lib/datetime/civil-date";

const INCOME_PATH = "/receitas";
const EXPENSE_PATH = "/despesas";
function flashPath(formData: FormData, fallback: string) {
  return readReturnTo(formData) ?? fallback;
}

function finishFormNavigation(formData: FormData) {
  const returnTo = readReturnTo(formData);
  if (returnTo) redirect(returnTo);
}

function workspaceOrAbort(userId: string) {
  return resolveWorkspaceContext(userId);
}

function categorizationFrom(formData: FormData) {
  const merchant = String(formData.get("aiMerchant") || "").trim();
  const source = String(formData.get("aiSuggestionSource") || "");
  if (!merchant || (source !== "OLLAMA" && source !== "RULE")) return undefined;
  return {
    merchant,
    suggestedCategoryId: String(formData.get("aiSuggestedCategoryId") || "") || undefined,
    source,
  } as const;
}

export async function createIncomeAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await workspaceOrAbort(user.id);
  if (!selected) return;

  const created = await createOneOffIncome(user.id, selected.id, {
    accountId: String(formData.get("accountId")),
    amount: String(formData.get("amount")),
    description: String(formData.get("description")),
    occurredAt: new Date(),
    status: formData.get("status") === "EXPECTED" ? "EXPECTED" : "COMPLETED",
    sourceType: "OTHER",
    categoryId: String(formData.get("categoryId") || "") || undefined,
    categorization: categorizationFrom(formData),
  });

  const target = flashPath(formData, INCOME_PATH);
  if (!created) {
    await flashError("Não foi possível registar a receita. Verifica a conta e o montante.", target);
    finishFormNavigation(formData);
    return;
  }
  await flashSuccess("Receita registada.", target);

  revalidatePath("/receitas");
  revalidatePath("/transacoes");
  revalidatePath("/contas");
  finishFormNavigation(formData);
}

export async function createFamilyIncomeAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await workspaceOrAbort(user.id);
  if (!selected) return;

  const created = await createFamilyIncomeSeries(user.id, selected.id, {
    accountId: String(formData.get("accountId")),
    familyOrigin: String(formData.get("familyOrigin")),
    amount: String(formData.get("amount")),
    frequency: String(formData.get("frequency")) as "WEEKLY" | "BIWEEKLY" | "MONTHLY",
    nextDueAt: civilDateIsoToInstant(String(formData.get("nextDueAt"))),
    certainty: String(formData.get("certainty")) as "HIGH" | "MEDIUM" | "LOW",
  });

  const target = flashPath(formData, INCOME_PATH);
  if (!created) {
    await flashError("Não foi possível criar a série familiar.", target);
    finishFormNavigation(formData);
    return;
  }
  await flashSuccess("Série familiar criada.", target);

  revalidatePath("/receitas");
  finishFormNavigation(formData);
}

export async function confirmOccurrenceAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await workspaceOrAbort(user.id);
  if (!selected) return;

  const occurrenceId = String(formData.get("occurrenceId") || "").trim();
  const transactionId = String(formData.get("transactionId") || "").trim();
  const receivedAt = new Date();

  const result = transactionId
    ? await confirmOneOffExpectedIncome(user.id, selected.id, transactionId, receivedAt)
    : occurrenceId
      ? await confirmIncomeOccurrence(user.id, selected.id, occurrenceId, receivedAt)
      : { ok: false as const };

  if (!result.ok) {
    await flashError("Não foi possível confirmar a receção.", INCOME_PATH);
    return;
  }
  await flashSuccess(
    result.alreadyConfirmed ? "Receção já estava confirmada." : "Receção confirmada como recebida.", INCOME_PATH,
  );

  revalidatePath("/receitas");
  revalidatePath("/transacoes");
  revalidatePath("/contas");
}

export async function createEcommerceAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await workspaceOrAbort(user.id);
  if (!selected) return;

  const created = await createEcommerceSaleRecord(user.id, selected.id, {
    accountId: String(formData.get("accountId")),
    marketplace: String(formData.get("marketplace") || ""),
    orderReference: String(formData.get("orderReference") || ""),
    grossAmount: String(formData.get("grossAmount")),
    marketplaceFees: String(formData.get("marketplaceFees") || "0"),
    shippingCost: String(formData.get("shippingCost") || "0"),
    otherCosts: String(formData.get("otherCosts") || "0"),
    taxReservePercentage: String(formData.get("taxReservePercentage") || "0"),
    saleDate: new Date(),
    recordPayout: formData.get("recordPayout") === "on",
  });

  const target = flashPath(formData, INCOME_PATH);
  if (!created) {
    await flashError("Não foi possível registar a venda.", target);
    finishFormNavigation(formData);
    return;
  }
  await flashSuccess("Venda registada.", target);

  revalidatePath("/receitas");
  revalidatePath("/transacoes");
  finishFormNavigation(formData);
}

export async function createTennisAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await workspaceOrAbort(user.id);
  if (!selected) return;

  const created = await createTournamentIncomeRecord(user.id, selected.id, {
    accountId: String(formData.get("accountId")),
    tournamentName: String(formData.get("tournamentName")),
    tournamentDate: civilDateIsoToInstant(String(formData.get("tournamentDate"))),
    location: String(formData.get("location") || ""),
    grossPrize: String(formData.get("grossPrize")),
    registrationFee: String(formData.get("registrationFee") || "0"),
    travelCost: String(formData.get("travelCost") || "0"),
    recordPayout: formData.get("recordPayout") === "on",
  });

  const target = flashPath(formData, INCOME_PATH);
  if (!created) {
    await flashError("Não foi possível registar o torneio.", target);
    finishFormNavigation(formData);
    return;
  }
  await flashSuccess("Torneio registado.", target);

  revalidatePath("/receitas");
  revalidatePath("/transacoes");
  finishFormNavigation(formData);
}

export async function createExpenseAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await workspaceOrAbort(user.id);
  if (!selected) return;

  const created = await createExpense(user.id, selected.id, {
    accountId: String(formData.get("accountId")),
    amount: String(formData.get("amount")),
    description: String(formData.get("description")),
    categoryId: String(formData.get("categoryId") || "") || undefined,
    occurredAt: formData.get("occurredAt")
      ? civilDateIsoToInstant(String(formData.get("occurredAt")))
      : new Date(),
    categorization: categorizationFrom(formData),
  });

  const target = flashPath(formData, EXPENSE_PATH);
  if (!created) {
    await flashError("Não foi possível registar a despesa. Verifica a conta e o montante.", target);
    finishFormNavigation(formData);
    return;
  }
  await flashSuccess("Despesa registada.", target);

  revalidatePath("/despesas");
  revalidatePath("/transacoes");
  revalidatePath("/contas");
  revalidatePath("/orcamentos");
  revalidatePath("/dashboard");
  finishFormNavigation(formData);
}
