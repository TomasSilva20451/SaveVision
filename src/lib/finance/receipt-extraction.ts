import { z } from "zod";
import { parseCivilDateIso, formatCivilDateIso, civilDateFromInstant } from "@/lib/datetime/civil-date";
import { decimal, normalizeDecimalInput, roundMoney } from "@/lib/finance/money";
import { normalizeMerchantDisplayLabel } from "@/lib/finance/merchant-normalization";
import {
  isPlausibleReceiptDate,
  isPlausibleReceiptTotal,
  parseFlexibleReceiptDate,
  repairReceiptExtractionRaw,
  sanitizeFiscalNumber,
  sanitizeMerchantName,
} from "@/lib/finance/receipt-extraction-repair";

const confidenceField = z.number().min(0).max(1).optional();

export const receiptItemRawSchema = z.object({
  description: z.string().trim().min(1).max(120),
  amount: z.union([z.string(), z.number()]),
});

export const receiptExtractionRawSchema = z.object({
  merchant: z.union([z.string(), z.null()]).optional(),
  date: z.union([z.string(), z.null()]).optional(),
  total: z.union([z.string(), z.number(), z.null()]).optional(),
  currency: z.union([z.string(), z.null()]).optional(),
  fiscalNumber: z.union([z.string(), z.null()]).optional(),
  items: z.array(receiptItemRawSchema).max(40).optional(),
  vatAmount: z.union([z.string(), z.number(), z.null()]).optional(),
  paymentMethod: z.union([z.string(), z.null()]).optional(),
  confidence: z
    .object({
      merchant: confidenceField,
      date: confidenceField,
      total: confidenceField,
      currency: confidenceField,
      fiscalNumber: confidenceField,
      vatAmount: confidenceField,
      paymentMethod: confidenceField,
    })
    .catch({}),
});

export type ReceiptExtractionRaw = z.infer<typeof receiptExtractionRawSchema>;

export type ReceiptItemDraft = {
  description: string;
  amount: string;
};

export type ReceiptDraft = {
  merchant: string;
  date: string | null;
  total: string | null;
  currency: string;
  fiscalNumber: string | null;
  vatAmount: string | null;
  paymentMethod: string | null;
  items: ReceiptItemDraft[];
  confidence: {
    merchant: number | null;
    date: number | null;
    total: number | null;
    currency: number | null;
    fiscalNumber: number | null;
    vatAmount: number | null;
    paymentMethod: number | null;
  };
};

export type ReceiptValidationCode =
  | "TOTAL_MISSING"
  | "TOTAL_LOW_CONFIDENCE"
  | "TOTAL_REQUIRES_REVIEW"
  | "TOTAL_IMPLAUSIBLE"
  | "DATE_INVALID"
  | "DATE_FUTURE"
  | "DATE_LOW_CONFIDENCE"
  | "DATE_IMPLAUSIBLE"
  | "ITEMS_SUM_MISMATCH"
  | "MERCHANT_LOW_CONFIDENCE"
  | "MERCHANT_UNREADABLE"
  | "CURRENCY_NOT_EUR";

export type ReceiptValidationIssue = {
  code: ReceiptValidationCode;
  message: string;
  field?: keyof ReceiptDraft | "items";
};

const TOTAL_CONFIDENCE_REVIEW = 0.9;
const FIELD_CONFIDENCE_HINT = 0.75;
const ITEMS_SUM_TOLERANCE = 0.05;

function normalizeOptionalMoney(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  const raw = typeof value === "number" ? String(value) : value.trim();
  if (!raw) return null;
  try {
    return roundMoney(normalizeDecimalInput(raw)).toFixed(2);
  } catch {
    return null;
  }
}

function normalizeOptionalText(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function normalizeCivilDate(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const flexible = parseFlexibleReceiptDate(value);
  if (flexible) return flexible;
  const candidate = value.trim().slice(0, 10);
  try {
    return formatCivilDateIso(parseCivilDateIso(candidate));
  } catch {
    return null;
  }
}

export function normalizeReceiptExtraction(raw: ReceiptExtractionRaw): ReceiptDraft {
  const parsed = receiptExtractionRawSchema.parse(repairReceiptExtractionRaw(raw));
  const merchant =
    sanitizeMerchantName(parsed.merchant ?? null) ??
    normalizeOptionalText("Comerciante desconhecido", 120)!;

  const currency = (parsed.currency?.trim().toUpperCase() || "EUR").slice(0, 8);

  return {
    merchant,
    date: normalizeCivilDate(parsed.date ?? null),
    total: normalizeOptionalMoney(parsed.total ?? null),
    currency,
    fiscalNumber: sanitizeFiscalNumber(parsed.fiscalNumber ?? null),
    vatAmount: normalizeOptionalMoney(parsed.vatAmount ?? null),
    paymentMethod: normalizeOptionalText(parsed.paymentMethod ?? null, 80),
    items: (parsed.items ?? [])
      .map((item) => {
        const amount = normalizeOptionalMoney(item.amount);
        if (!amount) return null;
        const description = item.description.trim().slice(0, 120);
        if (!description) return null;
        return { description, amount };
      })
      .filter((item): item is ReceiptItemDraft => item != null),
    confidence: {
      merchant: parsed.confidence.merchant ?? null,
      date: parsed.confidence.date ?? null,
      total: parsed.confidence.total ?? null,
      currency: parsed.confidence.currency ?? null,
      fiscalNumber: parsed.confidence.fiscalNumber ?? null,
      vatAmount: parsed.confidence.vatAmount ?? null,
      paymentMethod: parsed.confidence.paymentMethod ?? null,
    },
  };
}

export function validateReceiptDraft(draft: ReceiptDraft, now = new Date()): ReceiptValidationIssue[] {
  const issues: ReceiptValidationIssue[] = [];
  const today = civilDateFromInstant(now);

  if (draft.currency !== "EUR") {
    issues.push({
      code: "CURRENCY_NOT_EUR",
      field: "currency",
      message: `Moeda ${draft.currency} detetada. Introduz o montante em EUR (conversão manual) antes de registar.`,
    });
  }

  if (draft.merchant === "Comerciante desconhecido") {
    issues.push({
      code: "MERCHANT_UNREADABLE",
      field: "merchant",
      message: "Não foi possível identificar o comerciante. Escreve o nome manualmente.",
    });
  }

  if (!draft.total) {
    issues.push({
      code: "TOTAL_MISSING",
      field: "total",
      message: "Não foi possível ler um total fiável. Introduz o montante manualmente.",
    });
  } else if (!isPlausibleReceiptTotal(draft.total, draft.items.length)) {
    issues.push({
      code: "TOTAL_IMPLAUSIBLE",
      field: "total",
      message: "O total lido parece irrealista (ex.: confusão com números da fatura). Corrige manualmente.",
    });
  } else {
    if (draft.confidence.total != null && draft.confidence.total < TOTAL_CONFIDENCE_REVIEW) {
      issues.push({
        code: "TOTAL_LOW_CONFIDENCE",
        field: "total",
        message: "A leitura automática do total tem baixa confiança. Revê o valor antes de confirmar.",
      });
    }
    issues.push({
      code: "TOTAL_REQUIRES_REVIEW",
      field: "total",
      message: "Confirma sempre o total no recibo original; nunca é aceite em silêncio.",
    });
  }

  if (draft.date && !isPlausibleReceiptDate(draft.date, now)) {
    issues.push({
      code: "DATE_IMPLAUSIBLE",
      field: "date",
      message: "A data lida parece errada (muito antiga ou inválida). Confirma no documento.",
    });
  }

  if (draft.date) {
    try {
      const civil = parseCivilDateIso(draft.date);
      if (
        civil.year > today.year ||
        (civil.year === today.year && civil.month > today.month) ||
        (civil.year === today.year && civil.month === today.month && civil.day > today.day)
      ) {
        issues.push({
          code: "DATE_FUTURE",
          field: "date",
          message: "A data parece estar no futuro. Corrige se necessário.",
        });
      }
    } catch {
      issues.push({
        code: "DATE_INVALID",
        field: "date",
        message: "A data lida não é válida. Introduz a data correta.",
      });
    }
  } else if (draft.confidence.date != null && draft.confidence.date < FIELD_CONFIDENCE_HINT) {
    issues.push({
      code: "DATE_LOW_CONFIDENCE",
      field: "date",
      message: "A data foi difícil de ler. Verifica no recibo.",
    });
  }

  if (draft.confidence.merchant != null && draft.confidence.merchant < FIELD_CONFIDENCE_HINT) {
    issues.push({
      code: "MERCHANT_LOW_CONFIDENCE",
      field: "merchant",
      message: "O nome do comerciante pode estar incorreto. Revê a descrição.",
    });
  }

  if (draft.total && draft.items.length > 0) {
    const itemsSum = draft.items.reduce(
      (sum, item) => sum.plus(decimal(item.amount)),
      decimal(0),
    );
    const diff = itemsSum.minus(decimal(draft.total)).abs();
    if (diff.gt(ITEMS_SUM_TOLERANCE)) {
      issues.push({
        code: "ITEMS_SUM_MISMATCH",
        field: "items",
        message: `A soma dos itens (${itemsSum.toFixed(2)} €) não coincide com o total (${draft.total} €).`,
      });
    }
  }

  return issues;
}

export function receiptDraftToExpenseDescription(draft: ReceiptDraft): string {
  const parts = [normalizeMerchantDisplayLabel(draft.merchant.trim())];
  if (draft.fiscalNumber) {
    const label = draft.fiscalNumber.includes("-") ? "EIN" : "NIF";
    parts.push(`${label} ${draft.fiscalNumber}`);
  }
  if (draft.currency !== "EUR" && draft.total) {
    parts.push(`${draft.total} ${draft.currency}`);
  }
  return parts.join(" · ").slice(0, 240);
}
