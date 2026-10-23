import { z } from "zod";
import type { RecurrenceFrequency } from "@/lib/finance/recurring-schedule";

export const recurringPatternEnrichmentSchema = z
  .object({
    merchant: z.string().trim().min(1).max(100),
    serviceLabel: z.string().trim().min(1).max(80),
    kind: z.enum([
      "SUBSCRIPTION",
      "INSURANCE",
      "RENT",
      "UTILITIES",
      "MEMBERSHIP",
      "LOAN",
      "OTHER",
    ]),
    summary: z.string().trim().min(1).max(240),
  })
  .strict();

export type RecurringPatternEnrichment = z.infer<typeof recurringPatternEnrichmentSchema>;

export type RecurringPatternEnrichmentInput = {
  merchantPattern: string;
  frequency: RecurrenceFrequency;
  expectedAmount: string;
  samples: Array<{ description: string; occurredAt: string; amount: string }>;
};
