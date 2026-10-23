import type { ReceiptExtractionRaw } from "@/lib/finance/receipt-extraction";
import { normalizeDecimalInput, roundMoney } from "@/lib/finance/money";

const MONEY_IN_TEXT =
  /(?:€|\$|EUR|USD)?\s*([+-]?\d{1,6}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{2})/i;

const GARBAGE_MERCHANT =
  /^(?:NIF|EIN|IVA|VAT|TOTAL|USD|EUR|\$|€|\d[\d\s.,$€-]*)(?:\s·\s*(?:NIF|EIN|IVA|VAT|\$?\d))?$/i;

/** Rótulos de documento que modelos pequenos confundem com nome de loja. */
const GENERIC_MERCHANT_LABEL =
  /^(?:EMITENTE|ISSUER|INVOICE|FATURA|RECIBO|CLIENTE|CUSTOMER|BILL\s*TO|SHIP\s*TO|VENDOR|MERCHANT|FORNECEDOR|SUBTOTAL|AMOUNT\s*DUE|DESCRIPTION|DESCRIC(?:Ã|A)O|DATE|DATA|TOTAL)$/i;

const MIN_RECEIPT_YEAR = 2018;
const MAX_TOTAL_WITHOUT_ITEMS = 2500;
const SUSPICIOUS_TOTAL_FLOOR = 750;

const LABEL_ONLY_FISCAL = /^(?:NIF|VAT|EIN|IVA|NIPC|ATCUD)$/i;

const ENGLISH_MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

export function parseFlexibleReceiptDate(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const slash = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const year = Number(slash[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const english = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (english) {
    const month = ENGLISH_MONTHS[english[1]!.toLowerCase()];
    const day = Number(english[2]);
    const year = Number(english[3]);
    if (month && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

function tryNormalizeMoneyFragment(fragment: string): string | null {
  try {
    const cleaned = fragment.replace(/[€$]/g, "").trim();
    return roundMoney(normalizeDecimalInput(cleaned)).toFixed(2);
  } catch {
    return null;
  }
}

export function extractMoneyFromText(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const match = text.match(MONEY_IN_TEXT);
  if (!match?.[1]) return null;
  return tryNormalizeMoneyFragment(match[1]);
}

export function sanitizeFiscalNumber(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (LABEL_ONLY_FISCAL.test(trimmed)) return null;
  if (/^NIF\s+NIF$/i.test(trimmed)) return null;

  const ptNine = trimmed.match(/\b(\d{9})\b/);
  if (ptNine) return ptNine[1]!;

  const usEin = trimmed.match(/\b(\d{2}-\d{7})\b/);
  if (usEin) return usEin[1]!;

  if (/^\d{9,11}$/.test(trimmed.replace(/\s/g, ""))) {
    return trimmed.replace(/\s/g, "").slice(0, 32);
  }

  if (/\d/.test(trimmed) && trimmed.length <= 32 && !LABEL_ONLY_FISCAL.test(trimmed)) {
    return trimmed.slice(0, 32);
  }

  return null;
}

export function sanitizeMerchantName(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  let merchant = value.trim().replace(/\s+/g, " ");

  merchant = merchant.replace(/\s*·\s*NIF(?:\s+NIF)?\s*$/i, "").trim();
  if (GENERIC_MERCHANT_LABEL.test(merchant)) return null;
  if (GARBAGE_MERCHANT.test(merchant)) return null;
  if (/^[$€]?\d/.test(merchant) && merchant.length < 24) return null;

  return merchant.slice(0, 120);
}

function parseTotalAmount(value: string | null | undefined): number | null {
  if (value == null) return null;
  try {
    return Number(normalizeDecimalInput(String(value).replace(/[€$A-Z]/gi, "")));
  } catch {
    return null;
  }
}

export function isPlausibleReceiptDate(iso: string | null | undefined, now = new Date()): boolean {
  if (!iso) return false;
  const flexible = parseFlexibleReceiptDate(iso) ?? iso;
  const match = flexible.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const maxYear = now.getUTCFullYear() + 1;
  return year >= MIN_RECEIPT_YEAR && year <= maxYear;
}

export function isPlausibleReceiptTotal(
  total: string | null | undefined,
  itemsCount: number,
): boolean {
  const amount = parseTotalAmount(total);
  if (amount == null || amount <= 0 || amount > 50_000) return false;
  if (itemsCount === 0 && amount > MAX_TOTAL_WITHOUT_ITEMS) return false;
  if (itemsCount === 0 && amount >= SUSPICIOUS_TOTAL_FLOOR && amount % 1 === 0) {
    return false;
  }
  return true;
}

/** Penaliza extrações claramente erradas (rótulos, datas antigas, totais absurdos). */
export function scoreReceiptExtraction(raw: ReceiptExtractionRaw): number {
  const repaired = repairReceiptExtractionRaw({ ...raw });
  let score = 0;

  const merchant = sanitizeMerchantName(repaired.merchant == null ? null : String(repaired.merchant));
  if (merchant) score += 4;

  const items = repaired.items ?? [];
  const totalStr = repaired.total == null ? null : String(repaired.total);
  if (isPlausibleReceiptTotal(totalStr, items.length)) score += 4;
  else if (totalStr) score -= 6;

  const dateStr = repaired.date == null ? null : String(repaired.date);
  if (isPlausibleReceiptDate(dateStr)) score += 2;
  else if (dateStr) score -= 4;

  if (items.length > 0) score += 1;

  const conf = repaired.confidence ?? {};
  if (typeof conf.total === "number") score += conf.total;
  if (typeof conf.merchant === "number") score += conf.merchant * 0.5;

  return score;
}

function discardImplausibleFields(next: ReceiptExtractionRaw): ReceiptExtractionRaw {
  const items = next.items ?? [];
  if (next.merchant != null && !sanitizeMerchantName(String(next.merchant))) {
    next.merchant = null;
  }
  if (next.date != null && !isPlausibleReceiptDate(String(next.date))) {
    next.date = null;
  }
  if (next.total != null && !isPlausibleReceiptTotal(String(next.total), items.length)) {
    next.total = null;
  }
  return next;
}

/** Corrige alucinações comuns antes da normalização monetária. */
export function repairReceiptExtractionRaw(raw: ReceiptExtractionRaw): ReceiptExtractionRaw {
  const next: ReceiptExtractionRaw = { ...raw, confidence: { ...raw.confidence } };

  if (next.date) {
    const flexible = parseFlexibleReceiptDate(String(next.date));
    if (flexible) next.date = flexible;
  }

  if (next.fiscalNumber != null) {
    next.fiscalNumber = sanitizeFiscalNumber(String(next.fiscalNumber));
  }

  const merchantClean = sanitizeMerchantName(
    next.merchant == null ? null : String(next.merchant),
  );
  if (merchantClean) {
    next.merchant = merchantClean;
  } else if (next.merchant != null) {
    const rescuedTotal = extractMoneyFromText(String(next.merchant));
    if (rescuedTotal && !next.total) {
      next.total = rescuedTotal;
    }
    next.merchant = null;
  }

  if (!next.total && next.merchant) {
    const fromMerchant = extractMoneyFromText(String(next.merchant));
    if (fromMerchant) next.total = fromMerchant;
  }

  if (next.total != null && typeof next.total === "string") {
    const normalized = tryNormalizeMoneyFragment(String(next.total).replace(/[€$USD]/gi, ""));
    if (normalized) next.total = normalized;
  }

  if (next.currency) {
    next.currency = String(next.currency).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8) || "EUR";
  }

  return discardImplausibleFields(next);
}

export function receiptExtractionNeedsVisionFallback(raw: ReceiptExtractionRaw): boolean {
  return scoreReceiptExtraction(raw) < 6;
}
