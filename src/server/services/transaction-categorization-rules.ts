import type { CategoryNature, TransactionType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { patternForConfirmedSuggestion } from "@/lib/finance/transaction-categorization";

export type CategorizationDecision = {
  merchant: string;
  suggestedCategoryId?: string;
  source: "OLLAMA" | "RULE";
};

export async function rememberTransactionCategorizationDecision(input: {
  userId: string;
  workspaceId: string;
  description: string;
  transactionType: Extract<TransactionType, "INCOME" | "EXPENSE">;
  selectedCategoryId?: string;
  decision?: CategorizationDecision;
}): Promise<boolean> {
  if (!input.decision || !input.selectedCategoryId) return false;

  const category = await db.category.findFirst({
    where: { id: input.selectedCategoryId, workspaceId: input.workspaceId },
    select: { id: true, name: true, nature: true },
  });
  if (!category) return false;

  const pattern = patternForConfirmedSuggestion(input.description, input.decision.merchant);
  if (pattern.length < 2) return false;

  const corrected = input.decision.suggestedCategoryId !== category.id;
  try {
    await db.transactionCategorizationRule.upsert({
      where: {
        workspaceId_pattern_transactionType: {
          workspaceId: input.workspaceId,
          pattern,
          transactionType: input.transactionType,
        },
      },
      update: {
        merchant: input.decision.merchant.trim().slice(0, 100),
        categoryId: category.id,
        nature: category.nature as CategoryNature,
        lastConfirmedByUserId: input.userId,
        appliedCount: { increment: 1 },
        ...(corrected ? { correctionCount: { increment: 1 } } : {}),
      },
      create: {
        workspaceId: input.workspaceId,
        pattern,
        merchant: input.decision.merchant.trim().slice(0, 100),
        categoryId: category.id,
        transactionType: input.transactionType,
        nature: category.nature as CategoryNature,
        lastConfirmedByUserId: input.userId,
        correctionCount: corrected ? 1 : 0,
      },
    });
    return true;
  } catch {
    // A aprendizagem é auxiliar: nunca transforma uma transação já criada
    // numa submissão aparentemente falhada e, por isso, duplicável.
    return false;
  }
}
