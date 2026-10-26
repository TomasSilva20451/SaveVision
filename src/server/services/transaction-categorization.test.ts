import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/workspace-access", () => ({ requireWorkspaceEditor: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    category: { findMany: vi.fn() },
    transactionCategorizationRule: { findMany: vi.fn() },
  },
}));
vi.mock("@/server/services/expenses", () => ({ ensureDefaultCategories: vi.fn() }));
vi.mock("@/server/services/local-ai-settings", () => ({
  getLocalAiSettings: vi.fn().mockResolvedValue({
    enabled: true,
    ollamaBaseUrl: "http://127.0.0.1:11434",
    textModel: "qwen-test",
  }),
  isLocalAiActive: vi.fn().mockReturnValue(true),
}));
vi.mock("@/server/services/ml-governance", () => ({
  runGovernedMl: vi.fn(async (_context: unknown, execute: () => Promise<unknown>) => ({ source: "MODEL", value: await execute(), latencyMs: 1 })),
}));
vi.mock("@/server/providers/ollama-transaction-categorization", () => ({
  ollamaTransactionCategorizationProvider: { name: "mock-default", suggest: vi.fn() },
}));

import { requireWorkspaceEditor } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db";
import type { TransactionCategorizationProvider } from "@/server/providers/contracts";
import { suggestTransactionCategorization } from "@/server/services/transaction-categorization";

const categories = [
  { id: "cat-food", name: "Alimentação", nature: "NECESSARY" as const },
  { id: "cat-fun", name: "Lazer", nature: "DISCRETIONARY" as const },
];

describe("suggestTransactionCategorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireWorkspaceEditor).mockResolvedValue({ role: "OWNER" } as never);
    vi.mocked(db.category.findMany).mockResolvedValue(categories as never);
    vi.mocked(db.transactionCategorizationRule.findMany).mockResolvedValue([]);
  });

  it("envia nomes e naturezas, mas nunca IDs de categorias, ao provider", async () => {
    const provider: TransactionCategorizationProvider = {
      name: "qwen-test",
      suggest: vi.fn().mockResolvedValue({
        merchant: "Continente",
        category: "Alimentação",
        transactionType: "EXPENSE",
        nature: "NECESSARY",
        tags: ["supermercado"],
        confidence: 0.96,
        reason: "Cadeia de supermercados.",
      }),
    };

    const result = await suggestTransactionCategorization(
      "user-1",
      "ws-1",
      { description: "CONTINENTE MODELO 0182", amount: "84,32", direction: "EXPENSE" },
      provider,
    );

    expect(result?.categoryId).toBe("cat-food");
    expect(provider.suggest).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: "84.32",
        availableCategories: [
          { name: "Alimentação", nature: "NECESSARY" },
          { name: "Lazer", nature: "DISCRETIONARY" },
        ],
      }),
    );
    expect(JSON.stringify(vi.mocked(provider.suggest).mock.calls[0])).not.toContain("cat-food");
  });

  it("rejeita uma categoria inventada pelo modelo", async () => {
    const provider: TransactionCategorizationProvider = {
      name: "qwen-test",
      suggest: vi.fn().mockResolvedValue({
        merchant: "Loja",
        category: "Categoria inexistente",
        transactionType: "EXPENSE",
        nature: "DISCRETIONARY",
        tags: [],
        confidence: 0.7,
        reason: "Suposição.",
      }),
    };

    await expect(
      suggestTransactionCategorization(
        "user-1",
        "ws-1",
        { description: "LOJA 123", amount: "10", direction: "EXPENSE" },
        provider,
      ),
    ).rejects.toThrow("MODEL_INVENTED_CATEGORY");
  });

  it("usa uma correção do workspace antes de chamar o modelo", async () => {
    vi.mocked(db.transactionCategorizationRule.findMany).mockResolvedValue([
      {
        pattern: "NETFLIX COM",
        merchant: "Netflix",
        transactionType: "EXPENSE",
        category: categories[1],
      },
    ] as never);
    const provider: TransactionCategorizationProvider = {
      name: "qwen-test",
      suggest: vi.fn(),
    };

    const result = await suggestTransactionCategorization(
      "user-1",
      "ws-1",
      { description: "NETFLIX.COM 10/2026", amount: "12.99", direction: "EXPENSE" },
      provider,
    );

    expect(result?.source).toBe("RULE");
    expect(result?.categoryName).toBe("Lazer");
    expect(provider.suggest).not.toHaveBeenCalled();
  });
});
