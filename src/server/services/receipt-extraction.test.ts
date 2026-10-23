import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReceiptExtractionProvider } from "@/server/providers/contracts";

vi.mock("@/lib/auth/workspace-access", () => ({ requireWorkspaceEditor: vi.fn() }));
vi.mock("@/server/services/documents", () => ({
  uploadDocument: vi.fn(),
}));
vi.mock("@/server/services/transaction-categorization", () => ({
  suggestTransactionCategorization: vi.fn(),
}));
vi.mock("@/server/providers/receipt-extraction-composite", () => ({
  compositeReceiptExtractionProvider: { name: "mock-composite", extractFromImage: vi.fn() },
}));
vi.mock("@/lib/db", () => ({
  db: {
    transaction: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

import { requireWorkspaceEditor } from "@/lib/auth/workspace-access";
import { uploadDocument } from "@/server/services/documents";
import { suggestTransactionCategorization } from "@/server/services/transaction-categorization";
import { extractReceiptFromImage } from "@/server/services/receipt-extraction";

const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Array(600).fill(0)]);

describe("extractReceiptFromImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireWorkspaceEditor).mockResolvedValue({ role: "OWNER" } as never);
    vi.mocked(uploadDocument).mockResolvedValue({
      document: { id: "doc_test", originalName: "recibo.jpg" },
    } as never);
    vi.mocked(suggestTransactionCategorization).mockResolvedValue({
      categoryId: "cat_food",
      categoryName: "Alimentação",
      confidence: 0.8,
    } as never);
  });

  it("combina extração, validação e sugestão de categoria", async () => {
    const provider: ReceiptExtractionProvider = {
      name: "mock-moondream",
      async extractFromImage() {
        return {
          merchant: "Continente",
          date: "2026-10-18",
          total: "34.76",
          currency: "EUR",
          fiscalNumber: null,
          vatAmount: "6.40",
          paymentMethod: "Multibanco",
          items: [{ description: "Leite", amount: "2.10" }],
          confidence: { merchant: 0.95, date: 0.84, total: 0.97 },
        };
      },
    };

    const result = await extractReceiptFromImage(
      "user",
      "ws",
      { name: "recibo.jpg", mimeType: "image/jpeg", bytes: jpegHeader },
      provider,
    );

    expect(result?.documentId).toBe("doc_test");
    expect(result?.draft.total).toBe("34.76");
    expect(result?.suggestedCategoryId).toBe("cat_food");
    expect(result?.issues.some((i) => i.code === "TOTAL_REQUIRES_REVIEW")).toBe(true);
  });
});
