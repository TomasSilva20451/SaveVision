import { z } from "zod";
import { normalizeCategorizationPattern } from "@/lib/finance/merchant-normalization";

export const transactionCategorizationOutputSchema = z
  .object({
    merchant: z.string().trim().min(1).max(100),
    category: z.string().trim().min(1).max(100).nullable(),
    transactionType: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
    nature: z.enum(["NECESSARY", "DISCRETIONARY"]).nullable(),
    tags: z.array(z.string().trim().min(1).max(40)).max(5),
    confidence: z.number().min(0).max(1),
    reason: z.string().trim().min(1).max(240),
  })
  .strict();

export { normalizeCategorizationPattern, normalizeMerchantSearchPattern } from "@/lib/finance/merchant-normalization";

export function patternForConfirmedSuggestion(description: string, merchant: string): string {
  const normalizedDescription = normalizeCategorizationPattern(description);
  const normalizedMerchant = normalizeCategorizationPattern(merchant);

  if (normalizedMerchant.length >= 2 && normalizedDescription.includes(normalizedMerchant)) {
    return normalizedMerchant;
  }

  return normalizedDescription;
}
