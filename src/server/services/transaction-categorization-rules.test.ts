import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    category: { findFirst: vi.fn() },
    transactionCategorizationRule: { upsert: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { rememberTransactionCategorizationDecision } from "@/server/services/transaction-categorization-rules";

describe("rememberTransactionCategorizationDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.category.findFirst).mockResolvedValue({
      id: "cat-fun",
      name: "Lazer",
      nature: "DISCRETIONARY",
    } as never);
    vi.mocked(db.transactionCategorizationRule.upsert).mockResolvedValue({} as never);
  });

  it("guarda no workspace a categoria corrigida pelo utilizador", async () => {
    const remembered = await rememberTransactionCategorizationDecision({
      userId: "user-1",
      workspaceId: "ws-1",
      description: "NETFLIX.COM 9981",
      transactionType: "EXPENSE",
      selectedCategoryId: "cat-fun",
      decision: {
        merchant: "Netflix",
        suggestedCategoryId: "cat-services",
        source: "OLLAMA",
      },
    });

    expect(remembered).toBe(true);
    expect(db.transactionCategorizationRule.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId_pattern_transactionType: {
            workspaceId: "ws-1",
            pattern: "NETFLIX",
            transactionType: "EXPENSE",
          },
        },
        create: expect.objectContaining({ categoryId: "cat-fun", correctionCount: 1 }),
        update: expect.objectContaining({
          categoryId: "cat-fun",
          correctionCount: { increment: 1 },
        }),
      }),
    );
  });

  it("não deixa uma falha auxiliar transformar a criação financeira em erro", async () => {
    vi.mocked(db.transactionCategorizationRule.upsert).mockRejectedValue(new Error("database unavailable"));

    await expect(
      rememberTransactionCategorizationDecision({
        userId: "user-1",
        workspaceId: "ws-1",
        description: "NETFLIX.COM",
        transactionType: "EXPENSE",
        selectedCategoryId: "cat-fun",
        decision: { merchant: "Netflix", source: "OLLAMA" },
      }),
    ).resolves.toBe(false);
  });
});
