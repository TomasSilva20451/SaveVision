import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/workspace-access", () => ({ requireWorkspaceEditor: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    transactionCategorizationSuggestion: { findMany: vi.fn(), upsert: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    transaction: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    transactionCategorizationRule: { findMany: vi.fn() },
  },
}));
vi.mock("@/server/services/transaction-categorization", () => ({
  suggestTransactionCategorization: vi.fn(),
}));
vi.mock("@/server/services/transaction-categorization-rules", () => ({
  rememberTransactionCategorizationDecision: vi.fn(),
}));
vi.mock("@/server/services/local-ai-settings", () => ({
  getLocalAiSettings: vi.fn().mockResolvedValue({ localAiEnabled: true, globalEnabled: true }),
  isLocalAiActive: vi.fn().mockReturnValue(true),
}));

import { requireWorkspaceEditor } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db";
import { applyCategorizationReview } from "@/server/services/transaction-categorization-batch";

describe("applyCategorizationReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireWorkspaceEditor).mockResolvedValue({ role: "OWNER" } as never);
  });

  it("rejeita sugestões pendentes", async () => {
    vi.mocked(db.transactionCategorizationSuggestion.findFirst).mockResolvedValue({
      id: "s1",
      transactionId: "tx1",
      suggestedCategoryId: "cat1",
      suggestedMerchant: "Loja",
      source: "RULE",
      status: "PENDING",
      transaction: { description: "Test", type: "EXPENSE" },
    } as never);

    const result = await applyCategorizationReview("u1", "ws1", {
      suggestionIds: ["s1"],
      accept: false,
    });
    expect(result?.updated).toBe(1);
    expect(db.transactionCategorizationSuggestion.update).toHaveBeenCalled();
  });
});
