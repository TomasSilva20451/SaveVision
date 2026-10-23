import { requireWorkspaceEditor } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db";
import { decimal } from "@/lib/finance/money";
import { normalizeMerchant } from "@/lib/finance/merchant-normalization";
import { normalizeCategorizationPattern } from "@/lib/finance/transaction-categorization";
import type {
  TransactionCategorizationDirection,
  TransactionCategorizationProvider,
} from "@/server/providers/contracts";
import { createOllamaTransactionCategorizationProvider } from "@/server/providers/ollama-transaction-categorization";
import { ensureDefaultCategories } from "@/server/services/expenses";
import { getLocalAiSettings, isLocalAiActive } from "@/server/services/local-ai-settings";

export type TransactionCategorizationSuggestion = {
  merchant: string;
  categoryId: string | null;
  categoryName: string | null;
  transactionType: "INCOME" | "EXPENSE" | "TRANSFER";
  nature: "NECESSARY" | "DISCRETIONARY" | null;
  tags: string[];
  confidence: number;
  reason: string;
  source: "RULE" | "OLLAMA";
  provider: string;
  availableCategories: Array<{
    id: string;
    name: string;
    nature: "NECESSARY" | "DISCRETIONARY";
  }>;
};

export async function suggestTransactionCategorization(
  userId: string,
  workspaceId: string,
  input: {
    description: string;
    amount: string;
    direction: TransactionCategorizationDirection;
    forceCategory?: boolean;
  },
  provider?: TransactionCategorizationProvider,
): Promise<TransactionCategorizationSuggestion | null> {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const description = input.description.trim().slice(0, 240);
  if (description.length < 3) throw new Error("DESCRIPTION_TOO_SHORT");
  const amount = decimal(input.amount).abs();
  if (!amount.isFinite() || amount.lte(0)) throw new Error("INVALID_AMOUNT");

  await ensureDefaultCategories(workspaceId);
  const [categories, rules] = await Promise.all([
    db.category.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, nature: true },
    }),
    db.transactionCategorizationRule.findMany({
      where: { workspaceId, transactionType: input.direction, categoryId: { not: null } },
      orderBy: [{ updatedAt: "desc" }],
      take: 100,
      include: { category: { select: { id: true, name: true, nature: true } } },
    }),
  ]);

  const normalizedDescription = normalizeCategorizationPattern(description);
  const matchingRule = rules
    .filter((rule) => rule.category && normalizedDescription.includes(rule.pattern))
    .sort((a, b) => b.pattern.length - a.pattern.length)[0];

  if (matchingRule?.category) {
    const merchant = normalizeMerchant(matchingRule.merchant).displayLabel;
    return {
      merchant,
      categoryId: matchingRule.category.id,
      categoryName: matchingRule.category.name,
      transactionType: input.direction,
      nature: matchingRule.category.nature,
      tags: ["correção anterior"],
      confidence: 1,
      reason: "Baseado numa categorização confirmada anteriormente neste workspace.",
      source: "RULE",
      provider: "regra do workspace",
      availableCategories: categories,
    };
  }

  const aiSettings = await getLocalAiSettings(userId);
  if (!isLocalAiActive(aiSettings)) {
    return null;
  }

  const llm =
    provider ??
    createOllamaTransactionCategorizationProvider({
      baseUrl: aiSettings.ollamaBaseUrl,
      model: aiSettings.textModel,
    });

  const examples = rules.slice(0, 8).map((rule) => ({
    pattern: rule.pattern,
    merchant: rule.merchant,
    category: rule.category?.name ?? null,
    transactionType: rule.transactionType as "INCOME" | "EXPENSE",
  }));
  const output = await llm.suggest({
    description,
    amount: amount.toFixed(2),
    direction: input.direction,
    availableCategories: categories.map((category) => ({
      name: category.name,
      nature: category.nature,
    })),
    examples,
    forceCategory: input.forceCategory,
  });

  const category = output.category
    ? categories.find(
        (candidate) => candidate.name.toLocaleLowerCase("pt-PT") === output.category?.toLocaleLowerCase("pt-PT"),
      )
    : null;
  if (output.category && !category) throw new Error("MODEL_INVENTED_CATEGORY");

  const isTransfer = output.transactionType === "TRANSFER" && !input.forceCategory;
  const merchant = normalizeMerchant(output.merchant).displayLabel;
  return {
    merchant,
    categoryId: isTransfer ? null : (category?.id ?? null),
    categoryName: isTransfer ? null : (category?.name ?? null),
    transactionType: output.transactionType,
    nature: isTransfer ? null : (category?.nature ?? output.nature),
    tags: [...new Set(output.tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 5),
    confidence: output.confidence,
    reason: output.reason,
    source: "OLLAMA",
    provider: llm.name,
    availableCategories: categories,
  };
}
