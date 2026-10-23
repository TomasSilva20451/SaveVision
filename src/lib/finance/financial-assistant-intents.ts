import { z } from "zod";

export const FINANCIAL_ASSISTANT_INTENTS = [
  "expense_total_by_category",
  "expense_trend_by_category",
  "savings_rate",
  "upcoming_payments",
  "emergency_fund_gap",
  "highest_balance_account",
  "can_save_monthly",
] as const;

export type FinancialAssistantIntent = (typeof FINANCIAL_ASSISTANT_INTENTS)[number];

export const financialAssistantIntentSet = new Set<string>(FINANCIAL_ASSISTANT_INTENTS);

export const assistantPeriodSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("month"),
    yearMonth: z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM"),
  }),
  z.object({
    kind: z.literal("lastMonths"),
    count: z.number().int().min(1).max(24),
  }),
]);

export type AssistantPeriod = z.infer<typeof assistantPeriodSchema>;

const categoryNameSchema = z.string().trim().min(1).max(80);

export const expenseTotalByCategoryParamsSchema = z.object({
  categoryName: categoryNameSchema,
  period: assistantPeriodSchema.optional(),
});

export const expenseTrendByCategoryParamsSchema = z.object({
  months: z.number().int().min(2).max(12).optional(),
});

export const savingsRateParamsSchema = z.object({
  period: assistantPeriodSchema.optional(),
});

export const upcomingPaymentsParamsSchema = z.object({
  days: z.number().int().min(1).max(30).optional(),
});

export const emergencyFundGapParamsSchema = z.object({});

export const highestBalanceAccountParamsSchema = z.object({});

export const canSaveMonthlyParamsSchema = z.object({
  amount: z.union([z.number().positive().max(1_000_000), z.string().trim().min(1).max(20)]),
});

export const financialAssistantRawOutputSchema = z.object({
  intent: z.string().trim().min(1).max(64),
  parameters: z.record(z.string(), z.unknown()).default({}),
  confidence: z.number().min(0).max(1),
  clarification: z.string().trim().max(400).nullable(),
});

export type FinancialAssistantRawOutput = z.infer<typeof financialAssistantRawOutputSchema>;

export type ValidatedAssistantIntent =
  | { intent: "expense_total_by_category"; parameters: z.infer<typeof expenseTotalByCategoryParamsSchema> }
  | { intent: "expense_trend_by_category"; parameters: z.infer<typeof expenseTrendByCategoryParamsSchema> }
  | { intent: "savings_rate"; parameters: z.infer<typeof savingsRateParamsSchema> }
  | { intent: "upcoming_payments"; parameters: z.infer<typeof upcomingPaymentsParamsSchema> }
  | { intent: "emergency_fund_gap"; parameters: z.infer<typeof emergencyFundGapParamsSchema> }
  | { intent: "highest_balance_account"; parameters: z.infer<typeof highestBalanceAccountParamsSchema> }
  | { intent: "can_save_monthly"; parameters: z.infer<typeof canSaveMonthlyParamsSchema> };

export function parseAssistantPeriodDefault(
  period: AssistantPeriod | undefined,
  today: { year: number; month: number },
): AssistantPeriod {
  if (period) return period;
  const month = String(today.month).padStart(2, "0");
  return { kind: "month", yearMonth: `${today.year}-${month}` };
}

export function validateAssistantIntent(raw: FinancialAssistantRawOutput): ValidatedAssistantIntent | null {
  if (!financialAssistantIntentSet.has(raw.intent)) return null;
  const intent = raw.intent as FinancialAssistantIntent;

  switch (intent) {
    case "expense_total_by_category": {
      const parameters = expenseTotalByCategoryParamsSchema.safeParse(raw.parameters);
      return parameters.success ? { intent, parameters: parameters.data } : null;
    }
    case "expense_trend_by_category": {
      const parameters = expenseTrendByCategoryParamsSchema.safeParse(raw.parameters);
      return parameters.success ? { intent, parameters: parameters.data } : null;
    }
    case "savings_rate": {
      const parameters = savingsRateParamsSchema.safeParse(raw.parameters);
      return parameters.success ? { intent, parameters: parameters.data } : null;
    }
    case "upcoming_payments": {
      const parameters = upcomingPaymentsParamsSchema.safeParse(raw.parameters);
      return parameters.success ? { intent, parameters: parameters.data } : null;
    }
    case "emergency_fund_gap": {
      emergencyFundGapParamsSchema.parse(raw.parameters);
      return { intent, parameters: {} };
    }
    case "highest_balance_account": {
      highestBalanceAccountParamsSchema.parse(raw.parameters);
      return { intent, parameters: {} };
    }
    case "can_save_monthly": {
      const parameters = canSaveMonthlyParamsSchema.safeParse(raw.parameters);
      return parameters.success ? { intent, parameters: parameters.data } : null;
    }
    default:
      return null;
  }
}

export function normalizeCategoryNameForMatch(name: string): string {
  return name.trim().toLocaleLowerCase("pt-PT");
}

export function matchCategoryByName<
  T extends { id: string; name: string },
>(categories: readonly T[], categoryName: string): T | null {
  const needle = normalizeCategoryNameForMatch(categoryName);
  const exact = categories.find((c) => normalizeCategoryNameForMatch(c.name) === needle);
  if (exact) return exact;

  const partial = categories.filter(
    (c) =>
      normalizeCategoryNameForMatch(c.name).includes(needle) ||
      needle.includes(normalizeCategoryNameForMatch(c.name)),
  );
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) return null;
  return null;
}
