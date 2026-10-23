import "server-only";

import {
  parseMonthlyReportNarrativeModel,
  type MonthlyReportFacts,
} from "@/lib/finance/monthly-report-summary";
import { ollamaBaseUrlForReceipt } from "@/server/providers/ollama-receipt-shared";

const DEFAULT_MODEL = "gemma3:4b";

const responseFormat = {
  type: "object",
  additionalProperties: false,
  required: ["narrative"],
  properties: {
    narrative: { type: "string", minLength: 20, maxLength: 2000 },
  },
} as const;

function modelName(): string {
  return (
    process.env.OLLAMA_REPORT_MODEL?.trim() ||
    process.env.OLLAMA_EXPLANATION_MODEL?.trim() ||
    DEFAULT_MODEL
  );
}

export async function narrateMonthlyReportWithOllama(facts: MonthlyReportFacts): Promise<{
  model: string;
  narrative: string;
}> {
  const response = await fetch(`${ollamaBaseUrlForReceipt()}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model: modelName(),
      stream: false,
      think: false,
      format: responseFormat,
      keep_alive: "10m",
      options: { temperature: 0.1, num_predict: 700 },
      messages: [
        {
          role: "system",
          content: [
            "Escreves resumos mensais financeiros em português de Portugal.",
            "Usa APENAS os valores e factos do JSON fornecido.",
            "Não inventes tendências, previsões, investimentos, garantias ou recomendações de produtos.",
            "Se monthsAvailable < 3, indica explicitamente que não há histórico suficiente para tendência de longo prazo.",
            "Copia montantes exatamente como aparecem no JSON (strings decimais) ou em formato EUR equivalente.",
            "Tom neutro, 1-3 parágrafos curtos.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            "Gera um resumo textual do período com base neste JSON calculado no servidor.",
            JSON.stringify(facts),
          ].join("\n"),
        },
      ],
    }),
  });

  if (!response.ok) throw new Error(`OLLAMA_HTTP_${response.status}`);

  const payload = (await response.json()) as { message?: { content?: unknown } };
  if (typeof payload.message?.content !== "string") throw new Error("OLLAMA_INVALID_RESPONSE");

  const parsed = parseMonthlyReportNarrativeModel(JSON.parse(payload.message.content));
  return { model: modelName(), narrative: parsed.narrative.trim() };
}
