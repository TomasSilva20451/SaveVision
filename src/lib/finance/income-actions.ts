"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";
import {
  confirmIncomeOccurrence,
  createEcommerceSaleRecord,
  createFamilyIncomeSeries,
  createOneOffIncome,
  createTournamentIncomeRecord,
} from "@/server/services/income";
import { flashError, flashSuccess } from "@/lib/ui/action-feedback";
import { createExpense } from "@/server/services/expenses";

function workspaceOrAbort(userId: string) {
  return resolveWorkspaceContext(userId);
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
  });

  if (!created) {
    await flashError("Não foi possível registar a receita. Verifica a conta e o montante.");
    return;
  }
  await flashSuccess("Receita registada.");

  revalidatePath("/receitas");
  revalidatePath("/transacoes");
  revalidatePath("/contas");
}

export async function createFamilyIncomeAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await workspaceOrAbort(user.id);
  if (!selected) return;

  await createFamilyIncomeSeries(user.id, selected.id, {
    accountId: String(formData.get("accountId")),
    familyOrigin: String(formData.get("familyOrigin")),
    amount: String(formData.get("amount")),
    frequency: String(formData.get("frequency")) as "WEEKLY" | "BIWEEKLY" | "MONTHLY",
    nextDueAt: new Date(String(formData.get("nextDueAt"))),
    certainty: String(formData.get("certainty")) as "HIGH" | "MEDIUM" | "LOW",
  });

  revalidatePath("/receitas");
}

export async function confirmOccurrenceAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await workspaceOrAbort(user.id);
  if (!selected) return;

  const result = await confirmIncomeOccurrence(
    user.id,
    selected.id,
    String(formData.get("occurrenceId")),
    new Date(),
  );

  if (!result.ok) {
    await flashError("Não foi possível confirmar a receção.");
    return;
  }
  await flashSuccess(
    result.alreadyConfirmed ? "Receção já estava confirmada." : "Receção confirmada como recebida.",
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

  await createEcommerceSaleRecord(user.id, selected.id, {
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

  revalidatePath("/receitas");
  revalidatePath("/transacoes");
}

export async function createTennisAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await workspaceOrAbort(user.id);
  if (!selected) return;

  await createTournamentIncomeRecord(user.id, selected.id, {
    accountId: String(formData.get("accountId")),
    tournamentName: String(formData.get("tournamentName")),
    tournamentDate: new Date(String(formData.get("tournamentDate"))),
    location: String(formData.get("location") || ""),
    grossPrize: String(formData.get("grossPrize")),
    registrationFee: String(formData.get("registrationFee") || "0"),
    travelCost: String(formData.get("travelCost") || "0"),
    recordPayout: formData.get("recordPayout") === "on",
  });

  revalidatePath("/receitas");
  revalidatePath("/transacoes");
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
    occurredAt: new Date(),
  });

  if (!created) {
    await flashError("Não foi possível registar a despesa. Verifica a conta e o montante.");
    return;
  }
  await flashSuccess("Despesa registada.");

  revalidatePath("/despesas");
  revalidatePath("/transacoes");
  revalidatePath("/contas");
  revalidatePath("/orcamentos");
  revalidatePath("/dashboard");
}
