"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { flashError, flashSuccess } from "@/lib/ui/action-feedback";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";
import {
  addGoalContribution,
  createSavingsGoal,
  registerCgdProduct,
  updatePlanningSettings,
} from "@/server/services/planning";

export async function createSavingsGoalAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const parsed = z
    .object({
      title: z.string().min(1),
      targetAmount: z.string().min(1),
      kind: z.enum(["GENERAL", "EMERGENCY_FUND"]),
      accountId: z.string().optional(),
    })
    .safeParse({
      title: formData.get("title"),
      targetAmount: formData.get("targetAmount"),
      kind: formData.get("kind"),
      accountId: (() => {
        const value = formData.get("accountId");
        return typeof value === "string" && value.length > 0 ? value : undefined;
      })(),
    });

  if (!parsed.success) {
    await flashError("Dados do objetivo inválidos.");
    return;
  }

  const goal = await createSavingsGoal(user.id, selected.id, parsed.data);
  if (!goal) {
    await flashError("Não foi possível criar o objetivo.");
    return;
  }
  await flashSuccess("Objetivo criado.");
  revalidatePath("/planeamento");
}

export async function addGoalContributionAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const parsed = z
    .object({
      goalId: z.string().min(1),
      amount: z.string().min(1),
      notes: z.string().optional(),
    })
    .safeParse({
      goalId: formData.get("goalId"),
      amount: formData.get("amount"),
      notes: formData.get("notes") || undefined,
    });

  if (!parsed.success) return;

  await addGoalContribution(user.id, selected.id, {
    ...parsed.data,
    contributedAt: new Date(),
  });
  revalidatePath("/planeamento");
}

export async function updatePlanningSettingsAction(
  formData: FormData,
): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const parsed = z
    .object({
      emergencyFundTargetMonths: z.coerce.number().int().min(1).max(24),
      monthlyEssentialExpenses: z.string().optional(),
    })
    .safeParse({
      emergencyFundTargetMonths: formData.get("emergencyFundTargetMonths"),
      monthlyEssentialExpenses:
        formData.get("monthlyEssentialExpenses") || undefined,
    });

  if (!parsed.success) return;

  await updatePlanningSettings(user.id, selected.id, parsed.data);
  revalidatePath("/planeamento");
}

export async function registerCgdProductAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const parsed = z
    .object({
      label: z.string().min(1),
      category: z.enum(["DEPOSIT", "SAVINGS", "INVESTMENT", "OTHER"]),
      reference: z.string().optional(),
      notes: z.string().optional(),
    })
    .safeParse({
      label: formData.get("label"),
      category: formData.get("category"),
      reference: formData.get("reference") || undefined,
      notes: formData.get("notes") || undefined,
    });

  if (!parsed.success) return;

  await registerCgdProduct(user.id, selected.id, parsed.data);
  revalidatePath("/planeamento");
}
