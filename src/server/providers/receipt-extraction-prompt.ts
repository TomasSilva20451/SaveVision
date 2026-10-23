export const RECEIPT_JSON_RESPONSE_FORMAT = {
  type: "object",
  additionalProperties: false,
  required: [
    "merchant",
    "date",
    "total",
    "currency",
    "fiscalNumber",
    "items",
    "vatAmount",
    "paymentMethod",
    "confidence",
  ],
  properties: {
    merchant: { anyOf: [{ type: "string", maxLength: 120 }, { type: "null" }] },
    date: { anyOf: [{ type: "string", maxLength: 32 }, { type: "null" }] },
    total: { anyOf: [{ type: "string", maxLength: 24 }, { type: "null" }] },
    currency: { anyOf: [{ type: "string", maxLength: 8 }, { type: "null" }] },
    fiscalNumber: { anyOf: [{ type: "string", maxLength: 32 }, { type: "null" }] },
    vatAmount: { anyOf: [{ type: "string", maxLength: 24 }, { type: "null" }] },
    paymentMethod: { anyOf: [{ type: "string", maxLength: 80 }, { type: "null" }] },
    items: {
      type: "array",
      maxItems: 40,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description", "amount"],
        properties: {
          description: { type: "string", maxLength: 120 },
          amount: { type: "string", maxLength: 24 },
        },
      },
    },
    confidence: {
      type: "object",
      additionalProperties: false,
      properties: {
        merchant: { type: "number", minimum: 0, maximum: 1 },
        date: { type: "number", minimum: 0, maximum: 1 },
        total: { type: "number", minimum: 0, maximum: 1 },
        currency: { type: "number", minimum: 0, maximum: 1 },
        fiscalNumber: { type: "number", minimum: 0, maximum: 1 },
        vatAmount: { type: "number", minimum: 0, maximum: 1 },
        paymentMethod: { type: "number", minimum: 0, maximum: 1 },
      },
    },
  },
} as const;

export function receiptExtractionPrompt(detailed: boolean): string {
  const base = [
    "Extrai dados de um recibo ou fatura (papel, foto ou captura de PDF).",
    "merchant = marca ou loja no cabeçalho (ex.: Continente, Cursor). Nunca uses rótulos como Emitente, Invoice, Bill to, Cliente ou Total.",
    "date = data de emissão ou pagamento em AAAA-MM-DD quando possível.",
    "total = montante final «Amount due» / «Total a pagar» (número decimal com ponto, sem símbolo).",
    "currency = EUR, USD, etc.",
    "fiscalNumber = NIF português (9 dígitos) ou EIN/IVA do emitente; null se só vires a palavra «NIF» sem número.",
    "vatAmount = IVA/VAT total se existir linha dedicada.",
    "items = linhas de produto/serviço com preço; pode estar vazio em faturas simples.",
    "paymentMethod = cartão, Multibanco, etc., ou null.",
    "confidence = 0-1 por campo.",
    "Se houver subtotal e total, usa só o total final.",
    "Responde só com JSON.",
  ];

  if (detailed) {
    base.push(
      "Documentos em inglês (ex.: faturas SaaS) são comuns: lê «Invoice», «Amount due», «Date of issue».",
      "Exemplo merchant: «Cursor» (não «Telmo Silva»).",
      "Exemplo total: 24.60 com currency USD se assim estiver no documento.",
    );
  }

  return base.join("\n");
}
