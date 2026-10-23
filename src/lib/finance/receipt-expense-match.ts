import { civilDateFromInstant, formatCivilDateIso, parseCivilDateIso } from "@/lib/datetime/civil-date";
import { decimal } from "@/lib/finance/money";
import { normalizeMerchantSearchPattern } from "@/lib/finance/merchant-normalization";
import type { ReceiptDraft } from "@/lib/finance/receipt-extraction";

export const RECEIPT_DUPLICATE_DAY_WINDOW = 3;
export const RECEIPT_DUPLICATE_AMOUNT_TOLERANCE = "0.01";
export const RECEIPT_DUPLICATE_HIGH_SCORE = 3;

export type ReceiptDuplicateCandidate = {
  transactionId: string;
  score: number;
  reasons: string[];
  occurredAt: string;
  amount: string;
  description: string;
};

export type ReceiptMatchTransaction = {
  id: string;
  amount: string;
  occurredAt: Date;
  description: string | null;
};

function amountsMatch(a: string, b: string): boolean {
  return decimal(a).abs().minus(decimal(b).abs()).abs().lte(RECEIPT_DUPLICATE_AMOUNT_TOLERANCE);
}

function datesWithinWindow(receiptDateIso: string, txInstant: Date): boolean {
  const receipt = parseCivilDateIso(receiptDateIso);
  const tx = civilDateFromInstant(txInstant);
  const receiptOrd = receipt.year * 400 + receipt.month * 32 + receipt.day;
  const txOrd = tx.year * 400 + tx.month * 32 + tx.day;
  return Math.abs(receiptOrd - txOrd) <= RECEIPT_DUPLICATE_DAY_WINDOW;
}

function merchantMatches(receiptMerchant: string, txDescription: string | null): boolean {
  const a = normalizeMerchantSearchPattern(receiptMerchant);
  const b = normalizeMerchantSearchPattern(txDescription ?? "");
  if (a.length < 2 || b.length < 2) return false;
  return a.includes(b) || b.includes(a);
}

export function scoreReceiptAgainstTransaction(
  draft: Pick<ReceiptDraft, "merchant" | "total" | "date">,
  tx: ReceiptMatchTransaction,
): ReceiptDuplicateCandidate | null {
  if (!draft.total || !draft.date) return null;

  const reasons: string[] = [];
  let score = 0;

  if (amountsMatch(draft.total, tx.amount)) {
    score += 1;
    reasons.push("Montante igual");
  } else {
    return null;
  }

  if (datesWithinWindow(draft.date, tx.occurredAt)) {
    score += 1;
    reasons.push("Data próxima");
  }

  if (merchantMatches(draft.merchant, tx.description)) {
    score += 1;
    reasons.push("Comerciante similar");
  }

  if (score < 2) return null;

  return {
    transactionId: tx.id,
    score,
    reasons,
    occurredAt: formatCivilDateIso(civilDateFromInstant(tx.occurredAt)),
    amount: decimal(tx.amount.toString()).abs().toFixed(2),
    description: tx.description ?? "",
  };
}

export function findReceiptDuplicateCandidates(
  draft: Pick<ReceiptDraft, "merchant" | "total" | "date">,
  transactions: readonly ReceiptMatchTransaction[],
  limit = 3,
): ReceiptDuplicateCandidate[] {
  const scored = transactions
    .map((tx) => scoreReceiptAgainstTransaction(draft, tx))
    .filter((row): row is ReceiptDuplicateCandidate => row !== null)
    .sort((a, b) => b.score - a.score || a.occurredAt.localeCompare(b.occurredAt));

  return scored.slice(0, limit);
}
