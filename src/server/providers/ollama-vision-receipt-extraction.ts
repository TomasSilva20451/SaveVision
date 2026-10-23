import "server-only";

import { receiptExtractionRawSchema } from "@/lib/finance/receipt-extraction";
import type { ReceiptExtractionProvider } from "@/server/providers/contracts";
import {
  RECEIPT_JSON_RESPONSE_FORMAT,
  receiptExtractionPrompt,
} from "@/server/providers/receipt-extraction-prompt";
import { ollamaBaseUrlForReceipt } from "@/server/providers/ollama-receipt-shared";

const DEFAULT_MODEL = "qwen3.5:4b-mlx";

export const ollamaVisionReceiptExtractionProvider: ReceiptExtractionProvider = {
  name: process.env.OLLAMA_RECEIPT_FALLBACK_MODEL?.trim() || DEFAULT_MODEL,
  async extractFromImage(input) {
    const response = await fetch(`${ollamaBaseUrlForReceipt()}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(180_000),
      body: JSON.stringify({
        model: this.name,
        stream: false,
        think: false,
        format: RECEIPT_JSON_RESPONSE_FORMAT,
        keep_alive: "10m",
        options: { temperature: 0, num_predict: 1200 },
        messages: [
          {
            role: "system",
            content:
              "És um extrator conservador de recibos e faturas. Não inventes valores; usa null se não estiveres seguro.",
          },
          {
            role: "user",
            content: receiptExtractionPrompt(true),
            images: [input.imageBase64],
          },
        ],
      }),
    });

    if (!response.ok) throw new Error(`OLLAMA_HTTP_${response.status}`);

    const payload = (await response.json()) as { message?: { content?: unknown } };
    if (typeof payload.message?.content !== "string") throw new Error("OLLAMA_INVALID_RESPONSE");

    let json: unknown;
    try {
      json = JSON.parse(payload.message.content);
    } catch {
      throw new Error("OLLAMA_INVALID_JSON");
    }

    const parsed = receiptExtractionRawSchema.safeParse(json);
    if (!parsed.success) throw new Error("OLLAMA_SCHEMA_MISMATCH");

    return mapParsed(parsed.data);
  },
};

function mapParsed(parsed: ReturnType<typeof receiptExtractionRawSchema.parse>) {
  return {
    merchant: parsed.merchant ?? null,
    date: parsed.date ?? null,
    total: parsed.total == null ? null : String(parsed.total),
    currency: parsed.currency ?? null,
    fiscalNumber: parsed.fiscalNumber ?? null,
    vatAmount: parsed.vatAmount == null ? null : String(parsed.vatAmount),
    paymentMethod: parsed.paymentMethod ?? null,
    items: (parsed.items ?? []).map((item) => ({
      description: item.description,
      amount: String(item.amount),
    })),
    confidence: parsed.confidence ?? {},
  };
}
