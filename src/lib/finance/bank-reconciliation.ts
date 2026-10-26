import { civilDateFromInstant, formatCivilDateIso } from "@/lib/datetime/civil-date";
import { decimal } from "@/lib/finance/money";
import { normalizeMerchantSearchPattern } from "@/lib/finance/merchant-normalization";

export const RECONCILE_AMOUNT_TOLERANCE = "0.01";
export const RECONCILE_DAY_WINDOW = 2;
export const RECONCILE_AUTO_MIN_CONFIDENCE = 0.85;

export type ReconcileBankLine = {
  id: string;
  amount: string;
  bookingDate: Date;
  description: string | null;
};

export type ReconcileLedgerTx = {
  id: string;
  amount: string;
  occurredAt: Date;
  description: string | null;
};

export type ReconciliationCandidate = {
  bankLineId: string;
  transactionId: string;
  confidence: number;
  reasons: string[];
};

function datesClose(a: Date, b: Date): boolean {
  const toOrd = (d: Date) => {
    const c = civilDateFromInstant(d);
    return c.year * 400 + c.month * 32 + c.day;
  };
  return Math.abs(toOrd(a) - toOrd(b)) <= RECONCILE_DAY_WINDOW;
}

function amountsClose(a: string, b: string): boolean {
  return decimal(a).minus(b).abs().lte(RECONCILE_AMOUNT_TOLERANCE);
}

function textSimilar(a: string | null, b: string | null): boolean {
  const left = normalizeMerchantSearchPattern(a ?? "");
  const right = normalizeMerchantSearchPattern(b ?? "");
  if (left.length < 2 || right.length < 2) return false;
  return left.includes(right) || right.includes(left);
}

export function scoreReconciliationPair(
  line: ReconcileBankLine,
  tx: ReconcileLedgerTx,
): ReconciliationCandidate | null {
  if (!amountsClose(line.amount, tx.amount)) return null;

  const reasons: string[] = ["Montante"];
  let score = 0.6;

  if (datesClose(line.bookingDate, tx.occurredAt)) {
    score += 0.25;
    reasons.push("Data próxima");
  }

  if (textSimilar(line.description, tx.description)) {
    score += 0.15;
    reasons.push("Descrição similar");
  }

  if (score < RECONCILE_AUTO_MIN_CONFIDENCE && !datesClose(line.bookingDate, tx.occurredAt)) {
    return null;
  }

  return {
    bankLineId: line.id,
    transactionId: tx.id,
    confidence: Math.min(1, score),
    reasons,
  };
}

export function suggestReconciliationMatches(
  lines: ReconcileBankLine[],
  transactions: ReconcileLedgerTx[],
): ReconciliationCandidate[] {
  const usedTx = new Set<string>();
  const matches: ReconciliationCandidate[] = [];

  for (const line of lines) {
    let best: ReconciliationCandidate | null = null;
    for (const tx of transactions) {
      if (usedTx.has(tx.id)) continue;
      const candidate = scoreReconciliationPair(line, tx);
      if (!candidate) continue;
      if (!best || candidate.confidence > best.confidence) best = candidate;
    }
    if (best && best.confidence >= RECONCILE_AUTO_MIN_CONFIDENCE) {
      usedTx.add(best.transactionId);
      matches.push(best);
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence);
}

export function detectDuplicateBankLines(
  lines: Array<{ id: string; externalId: string; amount: string; bookingDate: Date; counterpartyHash: string | null }>,
): Map<string, string> {
  const duplicateOf = new Map<string, string>();
  const seen = new Map<string, string>();

  for (const line of lines) {
    const key = `${formatCivilDateIso(civilDateFromInstant(line.bookingDate))}|${decimal(line.amount).toFixed(4)}|${line.counterpartyHash ?? ""}`;
    const first = seen.get(key);
    if (first) duplicateOf.set(line.id, first);
    else seen.set(key, line.id);
  }
  return duplicateOf;
}
