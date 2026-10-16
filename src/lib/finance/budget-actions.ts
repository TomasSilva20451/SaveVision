"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { flashError, flashSuccess } from "@/lib/ui/action-feedback";
import {
  deleteBudgetLine,
  deleteMonthlyBudget,
  upsertBudgetLine,
} from "@/server/services/budgets";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

function parseYearMonth(formData: FormData) {
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

export async function upsertBudgetLineAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const ym = parseYearMonth(formData);
  if (!ym) {
    await flashError("Mês ou ano inválido.");
    return;
  }

  const created = await upsertBudgetLine(user.id, selected.id, {
    ...ym,
    categoryId: String(formData.get("categoryId")),
    limitAmount: String(formData.get("limitAmount")),
  });

  if (!created) {
    await flashError("Não foi possível guardar o limite. Verifica a categoria.");
    return;
  }

  await flashSuccess("Limite de orçamento guardado.");
  revalidatePath("/orcamentos");
  revalidatePath("/dashboard");
}

export async function deleteBudgetLineAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const lineId = String(formData.get("lineId"));
  const ok = await deleteBudgetLine(user.id, selected.id, lineId);
  if (!ok) {
    await flashError("Linha de orçamento não encontrada.");
    return;
  }

  await flashSuccess("Limite removido.");
  revalidatePath("/orcamentos");
  revalidatePath("/dashboard");
}

export async function deleteMonthlyBudgetAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const ym = parseYearMonth(formData);
  if (!ym) return;

  const ok = await deleteMonthlyBudget(user.id, selected.id, ym.year, ym.month);
  if (!ok) {
    await flashError("Orçamento não encontrado.");
    return;
  }

  await flashSuccess("Orçamento mensal eliminado.");
  revalidatePath("/orcamentos");
  revalidatePath("/dashboard");
}
