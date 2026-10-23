import "server-only";

import { receiptExtractionRawSchema } from "@/lib/finance/receipt-extraction";
import type { ReceiptExtractionProvider } from "@/server/providers/contracts";
import { ollamaBaseUrlForReceipt } from "@/server/providers/ollama-receipt-shared";
import {
  RECEIPT_JSON_RESPONSE_FORMAT,
  receiptExtractionPrompt,
} from "@/server/providers/receipt-extraction-prompt";

const DEFAULT_MODEL = "moondream:latest";

export const moondreamReceiptExtractionProvider: ReceiptExtractionProvider = {
  name: process.env.OLLAMA_RECEIPT_MODEL?.trim() || DEFAULT_MODEL,
  async extractFromImage(input) {
    const response = await fetch(`${ollamaBaseUrlForReceipt()}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        model: this.name,
        stream: false,
        format: RECEIPT_JSON_RESPONSE_FORMAT,
        keep_alive: "10m",
        options: { temperature: 0, num_predict: 900 },
        messages: [
          {
            role: "user",
            content: receiptExtractionPrompt(false),
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

    return {
      merchant: parsed.data.merchant ?? null,
      date: parsed.data.date ?? null,
      total: parsed.data.total == null ? null : String(parsed.data.total),
      currency: parsed.data.currency ?? null,
      fiscalNumber: parsed.data.fiscalNumber ?? null,
      vatAmount: parsed.data.vatAmount == null ? null : String(parsed.data.vatAmount),
      paymentMethod: parsed.data.paymentMethod ?? null,
      items: (parsed.data.items ?? []).map((item) => ({
        description: item.description,
        amount: String(item.amount),
      })),
      confidence: parsed.data.confidence ?? {},
    };
  },
};
