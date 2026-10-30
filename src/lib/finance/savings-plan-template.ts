import type { CategoryBehavior, CategoryNature } from "@/generated/prisma/client";

/** Chave idempotente do modelo (não é credencial). */
export const CHALLENGE_300_TEMPLATE_KEY = "fintwin-savings-challenge-300";

export type SavingsPlanBudgetTemplateLine = {
  categoryName: string;
  monthlyLimit: string;
  nature: CategoryNature;
  behavior: CategoryBehavior;
  needsUserClassificationConfirm: boolean;
};

export type SavingsPlanActivationTemplate = {
  templateKey: string;
  defaultName: string;
  targetAmount: string;
  targetDateIso: string;
  plannedWeeklyContribution: string;
  contributionWeekday: number;
  reviewWeekday: number;
  alertThresholdPercent: number;
  defaultSavingsAccountName: string;
  budgetLines: SavingsPlanBudgetTemplateLine[];
};

export const CHALLENGE_300_EUR_TEMPLATE: SavingsPlanActivationTemplate = {
  templateKey: CHALLENGE_300_TEMPLATE_KEY,
  defaultName: "Desafio 300 €",
  targetAmount: "300.00",
  targetDateIso: "2027-01-20",
  plannedWeeklyContribution: "25.00",
  contributionWeekday: 7,
  reviewWeekday: 7,
  alertThresholdPercent: 75,
  defaultSavingsAccountName: "Poupança 300",
  budgetLines: [
    {
      categoryName: "Supermercado",
      monthlyLimit: "180.00",
      nature: "NECESSARY",
      behavior: "VARIABLE",
      needsUserClassificationConfirm: false,
    },
    {
      categoryName: "Restaurantes",
      monthlyLimit: "60.00",
      nature: "DISCRETIONARY",
      behavior: "VARIABLE",
      needsUserClassificationConfirm: false,
    },
    {
      categoryName: "Uber",
      monthlyLimit: "40.00",
      nature: "DISCRETIONARY",
      behavior: "VARIABLE",
      needsUserClassificationConfirm: true,
    },
    {
      categoryName: "Internet e software",
      monthlyLimit: "80.00",
      nature: "NECESSARY",
      behavior: "FIXED",
      needsUserClassificationConfirm: true,
    },
    {
      categoryName: "Estudo e pessoal",
      monthlyLimit: "80.00",
      nature: "DISCRETIONARY",
      behavior: "VARIABLE",
      needsUserClassificationConfirm: true,
    },
  ],
};

export function getSavingsPlanTemplate(key: string): SavingsPlanActivationTemplate | null {
  if (key === CHALLENGE_300_TEMPLATE_KEY) return CHALLENGE_300_EUR_TEMPLATE;
  return null;
}
