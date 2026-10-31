"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { flashError, flashSuccess } from "@/lib/ui/action-feedback";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";
import {
  activateSavingsPlan,
  buildSavingsPlanActivationPreview,
  registerSavingsPlanWeeklyContribution,
  setSavingsPlanStatus,
  type SavingsPlanWizardInput,
} from "@/server/services/savings-plan";

const budgetLineSchema = z.object({
  categoryName: z.string().min(1),
  monthlyLimit: z.string().min(1),
  nature: z.enum(["NECESSARY", "DISCRETIONARY"]),
  behavior: z.enum(["FIXED", "VARIABLE"]),
});

const wizardSchema = z.object({
  name: z.string().min(1).max(120),
  targetAmount: z.string().min(1),
  targetDateIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  plannedWeeklyContribution: z.string().min(1),
  contributionWeekday: z.coerce.number().int().min(1).max(7),
  reviewWeekday: z.coerce.number().int().min(1).max(7),
  alertThresholdPercent: z.coerce.number().int().min(50).max(100),
  savingsAccountId: z.string().optional(),
  sourceAccountId: z.string().optional(),
  createSavingsAccountName: z.string().optional(),
  budgetStartMode: z.enum(["NEXT_MONTH", "PROPORTIONAL_CURRENT"]),
  budgetLines: z.array(budgetLineSchema).min(1),
  confirmBudgetOverrides: z.coerce.boolean().optional(),
  idempotencyKey: z.string().min(1).max(120),
});

function parseWizardForm(formData: FormData): SavingsPlanWizardInput | null {
  const budgetLinesRaw = formData.get("budgetLinesJson");
  let budgetLines: SavingsPlanWizardInput["budgetLines"] = [];
  if (typeof budgetLinesRaw === "string" && budgetLinesRaw.length > 0) {
    try {
      budgetLines = JSON.parse(budgetLinesRaw) as SavingsPlanWizardInput["budgetLines"];
    } catch {
      return null;
    }
  }
  const parsed = wizardSchema.safeParse({
    name: formData.get("name"),
    targetAmount: formData.get("targetAmount"),
    targetDateIso: formData.get("targetDateIso"),
    plannedWeeklyContribution: formData.get("plannedWeeklyContribution"),
    contributionWeekday: formData.get("contributionWeekday"),
    reviewWeekday: formData.get("reviewWeekday"),
    alertThresholdPercent: formData.get("alertThresholdPercent"),
    savingsAccountId: (() => {
      const v = formData.get("savingsAccountId");
      return typeof v === "string" && v.length > 0 ? v : undefined;
    })(),
    sourceAccountId: (() => {
      const v = formData.get("sourceAccountId");
      return typeof v === "string" && v.length > 0 ? v : undefined;
    })(),
    createSavingsAccountName: (() => {
      const v = formData.get("createSavingsAccountName");
      return typeof v === "string" && v.length > 0 ? v : undefined;
    })(),
    budgetStartMode: formData.get("budgetStartMode"),
    budgetLines,
    confirmBudgetOverrides: formData.get("confirmBudgetOverrides") === "on",
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) return null;
  return { ...parsed.data, confirmBudgetOverrides: parsed.data.confirmBudgetOverrides ?? false };
}

export async function previewSavingsPlanAction(
  formData: FormData,
): Promise<
  | { ok: true; preview: Awaited<ReturnType<typeof buildSavingsPlanActivationPreview>> }
  | { ok: false; error: string }
> {
  const user = await requireAuthenticatedUser();
  if (!user) return { ok: false, error: "Sessão inválida." };
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected || selected.type !== "PERSONAL") {
    return { ok: false, error: "O plano de poupança só pode ser activado no workspace pessoal." };
  }
  const input = parseWizardForm(formData);
  if (!input) return { ok: false, error: "Dados do plano inválidos." };
  const preview = await buildSavingsPlanActivationPreview(user.id, selected.id, input);
  if (!preview) return { ok: false, error: "Não foi possível gerar a pré-visualização." };
  return { ok: true, preview };
}

export async function activateSavingsPlanAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected || selected.type !== "PERSONAL") {
    await flashError("O plano de poupança só pode ser activado no workspace pessoal.");
    return;
  }
  const input = parseWizardForm(formData);
  if (!input) {
    await flashError("Dados do plano inválidos.");
    return;
  }
  const result = await activateSavingsPlan(user.id, selected.id, input);
  if (!result) {
    await flashError(
      "Activação recusada. Resolve conflitos de orçamento/conta ou confirma substituições.",
    );
    return;
  }
  if (result.reused) {
    await flashSuccess("Plano já estava activo — nada foi duplicado.");
  } else {
    await flashSuccess(
      "Plano de poupança activo. Cada contribuição semanal cria uma transferência da conta de origem para a poupança.",
    );
  }
  revalidatePath("/plano");
  revalidatePath("/dashboard");
  revalidatePath("/contas");
  revalidatePath("/transacoes");
  revalidatePath(`/plano/plano-poupanca/${result.planId}`);
}

export async function registerSavingsPlanContributionAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const parsed = z
    .object({
      planId: z.string().min(1),
      checkInId: z.string().min(1),
      amount: z.string().min(1),
      contributedAtIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      notes: z.string().optional(),
      transferConfirmed: z.enum(["on", "true"]).optional(),
    })
    .safeParse({
      planId: formData.get("planId"),
      checkInId: formData.get("checkInId"),
      amount: formData.get("amount"),
      contributedAtIso: formData.get("contributedAtIso"),
      notes: formData.get("notes") || undefined,
      transferConfirmed: formData.get("transferConfirmed") ?? "on",
    });

  if (!parsed.success) {
    await flashError("Dados da contribuição inválidos.");
    return;
  }

  const { civilDateIsoToInstant } = await import("@/lib/datetime/civil-date");
  const result = await registerSavingsPlanWeeklyContribution(user.id, selected.id, {
    planId: parsed.data.planId,
    checkInId: parsed.data.checkInId,
    amount: parsed.data.amount,
    contributedAt: civilDateIsoToInstant(parsed.data.contributedAtIso),
    notes: parsed.data.notes,
    transferConfirmed: true,
  });
  if (!result) {
    await flashError(
      "Não foi possível registar a contribuição. Verifica a conta de origem (ex.: CaixaJovem) nas definições do plano.",
    );
    return;
  }
  await flashSuccess(
    result.transferCreated
      ? "Contribuição registada e transferência criada entre contas."
      : "Contribuição registada.",
  );
  revalidatePath("/dashboard");
  revalidatePath("/plano");
  revalidatePath("/contas");
  revalidatePath("/transacoes");
  revalidatePath(`/plano/plano-poupanca/${parsed.data.planId}`);
}

export async function syncSavingsPlanTransfersAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;
  const planId = formData.get("planId");
  if (typeof planId !== "string" || !planId) return;

  const { syncMissingSavingsPlanContributionTransfers } = await import(
    "@/server/services/savings-plan"
  );
  const result = await syncMissingSavingsPlanContributionTransfers(user.id, selected.id, planId);
  if (!result) {
    await flashError("Sem permissão para sincronizar transferências.");
    return;
  }
  if (result.repaired === 0) {
    await flashSuccess("Não havia transferências em falta.");
  } else {
    await flashSuccess(
      `${result.repaired} transferência(s) criada(s) para contribuições anteriores.`,
    );
  }
  revalidatePath("/dashboard");
  revalidatePath("/contas");
  revalidatePath("/transacoes");
  revalidatePath(`/plano/plano-poupanca/${planId}`);
}

export async function setSavingsPlanStatusAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;
  const parsed = z
    .object({
      planId: z.string().min(1),
      status: z.enum(["PAUSED", "ACTIVE", "CANCELLED"]),
    })
    .safeParse({
      planId: formData.get("planId"),
      status: formData.get("status"),
    });
  if (!parsed.success) return;
  await setSavingsPlanStatus(user.id, selected.id, parsed.data.planId, parsed.data.status);
  revalidatePath("/plano");
  revalidatePath("/dashboard");
}
