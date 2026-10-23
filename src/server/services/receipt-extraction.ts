import { requireWorkspaceEditor } from "@/lib/auth/workspace-access";
import {
  normalizeReceiptExtraction,
  receiptDraftToExpenseDescription,
  validateReceiptDraft,
  type ReceiptDraft,
  type ReceiptValidationIssue,
} from "@/lib/finance/receipt-extraction";
import type { ReceiptExtractionProvider } from "@/server/providers/contracts";
import { compositeReceiptExtractionProvider } from "@/server/providers/receipt-extraction-composite";
import { uploadDocument } from "@/server/services/documents";
import {
  preprocessReceiptImage,
  receiptImageToBase64,
} from "@/server/services/receipt-image-preprocess";
import {
  findReceiptDuplicateCandidates,
  RECEIPT_DUPLICATE_HIGH_SCORE,
  type ReceiptDuplicateCandidate,
} from "@/lib/finance/receipt-expense-match";
import { db } from "@/lib/db";
import { suggestTransactionCategorization } from "@/server/services/transaction-categorization";

export type ReceiptExtractionResult = {
  documentId: string;
  draft: ReceiptDraft;
  description: string;
  issues: ReceiptValidationIssue[];
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
  categoryConfidence: number | null;
  duplicateCandidates: ReceiptDuplicateCandidate[];
  provider: string;
};

export async function extractReceiptFromImage(
  userId: string,
  workspaceId: string,
  file: { name: string; mimeType: string; bytes: Uint8Array },
  provider: ReceiptExtractionProvider = compositeReceiptExtractionProvider,
): Promise<ReceiptExtractionResult | null> {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const preprocessed = preprocessReceiptImage(file.bytes);
  const stored = await uploadDocument(userId, workspaceId, {
    name: file.name,
    mimeType: file.mimeType || preprocessed.mimeType,
    bytes: preprocessed.bytes,
  });
  if (!stored) throw new Error("UPLOAD_FAILED");
  if ("error" in stored) throw new Error("UPLOAD_REJECTED");

  const imageBase64 = receiptImageToBase64(preprocessed.bytes);
  const raw = await provider.extractFromImage({
    imageBase64,
    mimeType: preprocessed.mimeType as "image/jpeg" | "image/png",
  });

  const draft = normalizeReceiptExtraction(raw);
  if (!draft.date) {
    draft.date = null;
  }

  const issues = validateReceiptDraft(draft);
  const description = receiptDraftToExpenseDescription(draft);

  let suggestedCategoryId: string | null = null;
  let suggestedCategoryName: string | null = null;
  let categoryConfidence: number | null = null;

  if (draft.total && description.length >= 3) {
    try {
      const suggestion = await suggestTransactionCategorization(userId, workspaceId, {
        description,
        amount: draft.total,
        direction: "EXPENSE",
      });
      if (suggestion?.categoryId) {
        suggestedCategoryId = suggestion.categoryId;
        suggestedCategoryName = suggestion.categoryName;
        categoryConfidence = suggestion.confidence;
      }
    } catch {
      // Categorização opcional; o utilizador confirma manualmente.
    }
  }

  let duplicateCandidates: ReceiptDuplicateCandidate[] = [];
  if (draft.total && draft.date) {
    const recent = await db.transaction.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        status: "COMPLETED",
        type: "EXPENSE",
      },
      orderBy: { occurredAt: "desc" },
      take: 200,
      select: { id: true, amount: true, occurredAt: true, description: true },
    });
    duplicateCandidates = findReceiptDuplicateCandidates(
      { merchant: draft.merchant, total: draft.total, date: draft.date },
      recent.map((tx) => ({
        id: tx.id,
        amount: tx.amount.toString(),
        occurredAt: tx.occurredAt,
        description: tx.description,
      })),
    );
  }

  return {
    documentId: stored.document.id,
    draft,
    description,
    issues,
    suggestedCategoryId,
    suggestedCategoryName,
    categoryConfidence,
    duplicateCandidates,
    provider: provider.name,
  };
}

export { RECEIPT_DUPLICATE_HIGH_SCORE };
