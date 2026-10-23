import "server-only";

import type { ReceiptExtractionRaw } from "@/lib/finance/receipt-extraction";
import {
  repairReceiptExtractionRaw,
  scoreReceiptExtraction,
} from "@/lib/finance/receipt-extraction-repair";
import type {
  ReceiptExtractionModelOutput,
  ReceiptExtractionProvider,
} from "@/server/providers/contracts";
import { moondreamReceiptExtractionProvider } from "@/server/providers/moondream-receipt-extraction";
import { ollamaVisionReceiptExtractionProvider } from "@/server/providers/ollama-vision-receipt-extraction";

function toModelOutput(raw: ReceiptExtractionRaw): ReceiptExtractionModelOutput {
  const repaired = repairReceiptExtractionRaw(raw);
  return {
    merchant: repaired.merchant == null ? null : String(repaired.merchant),
    date: repaired.date == null ? null : String(repaired.date),
    total: repaired.total == null ? null : String(repaired.total),
    currency: repaired.currency == null ? null : String(repaired.currency),
    fiscalNumber: repaired.fiscalNumber == null ? null : String(repaired.fiscalNumber),
    vatAmount: repaired.vatAmount == null ? null : String(repaired.vatAmount),
    paymentMethod: repaired.paymentMethod == null ? null : String(repaired.paymentMethod),
    items: (repaired.items ?? []).map((item) => ({
      description: item.description,
      amount: String(item.amount),
    })),
    confidence: repaired.confidence ?? {},
  };
}

async function runProvider(
  provider: ReceiptExtractionProvider,
  input: Parameters<ReceiptExtractionProvider["extractFromImage"]>[0],
): Promise<ReceiptExtractionModelOutput> {
  return provider.extractFromImage(input);
}

function pickBest(candidates: ReceiptExtractionModelOutput[]): ReceiptExtractionModelOutput {
  return candidates.sort(
    (a, b) => scoreReceiptExtraction(b) - scoreReceiptExtraction(a),
  )[0]!;
}

export const compositeReceiptExtractionProvider: ReceiptExtractionProvider = {
  name: `${ollamaVisionReceiptExtractionProvider.name}+${moondreamReceiptExtractionProvider.name}`,
  async extractFromImage(input) {
    const candidates: ReceiptExtractionModelOutput[] = [];

    try {
      candidates.push(await runProvider(ollamaVisionReceiptExtractionProvider, input));
    } catch {
      // Continua para Moondream se o modelo principal falhar.
    }

    try {
      candidates.push(await runProvider(moondreamReceiptExtractionProvider, input));
    } catch {
      // Ignora se ambos falharem abaixo.
    }

    if (candidates.length === 0) {
      throw new Error("OLLAMA_NO_RECEIPT_MODEL");
    }

    return toModelOutput(pickBest(candidates));
  },
};
