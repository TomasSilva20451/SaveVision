import "server-only";

import {
  naturalLanguageExplanationSchema,
  type StructuredExplanationPayload,
} from "@/lib/finance/natural-language-explanation";

const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "qwen3.5:4b-mlx";

const responseFormat = {
  type: "object",
  additionalProperties: false,
  required: [
    "factualExplanation",
    "impactHighlight",
    "severityExplanation",
    "optionalSuggestion",
    "availableActionsSummary",
  ],
  properties: {
    factualExplanation: { type: "string", minLength: 1, maxLength: 480 },
    impactHighlight: { type: "string", minLength: 1, maxLength: 240 },
    severityExplanation: { type: "string", minLength: 1, maxLength: 220 },
    optionalSuggestion: { anyOf: [{ type: "string", maxLength: 220 }, { type: "null" }] },
    availableActionsSummary: { type: "string", minLength: 1, maxLength: 220 },
  },
} as const;

function ollamaBaseUrl(): string {
  const configured = process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const url = new URL(configured);
  const localHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
  if (process.env.OLLAMA_ALLOW_REMOTE !== "1" && !localHosts.has(url.hostname)) {
    throw new Error("OLLAMA_REMOTE_DISABLED");
  }
  return url.toString().replace(/\/$/, "");
}

function modelName(): string {
  return (
    process.env.OLLAMA_EXPLANATION_MODEL?.trim() ||
    process.env.OLLAMA_TRANSACTION_MODEL?.trim() ||
    DEFAULT_MODEL
  );
}

export async function explainWithOllama(payload: StructuredExplanationPayload) {
  const response = await fetch(`${ollamaBaseUrl()}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({
      model: modelName(),
      stream: false,
      think: false,
      format: responseFormat,
      keep_alive: "10m",
      options: { temperature: 0.1, num_predict: 420 },
      messages: [
        {
          role: "system",
          content:
            "Reescreves evidência financeira já calculada em português de Portugal. Não alteres valores, datas, prioridades, regras nem estados. optionalSuggestion só para hipóteses suaves e nunca como garantia.",
        },
        {
          role: "user",
          content: [
            "Transforma o JSON de evidência numa explicação acessível.",
            "Mantém números exatos da evidência.",
            "severityExplanation deve refletir severityGuide sem mudar a prioridade.",
            "Se optionalSuggestion existir, deve ser claramente hipotética (ex.: limite mais realista).",
            JSON.stringify(payload),
          ].join("\n"),
        },
      ],
    }),
  });

  if (!response.ok) throw new Error(`OLLAMA_HTTP_${response.status}`);
  const body = (await response.json()) as { message?: { content?: unknown } };
  if (typeof body.message?.content !== "string") throw new Error("OLLAMA_INVALID_RESPONSE");
  return naturalLanguageExplanationSchema.parse(JSON.parse(body.message.content));
}
