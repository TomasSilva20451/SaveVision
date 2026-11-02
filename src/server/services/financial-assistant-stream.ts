import "server-only";

import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";
import { askFinancialAssistant, type FinancialAssistantResult } from "@/server/services/financial-assistant";

const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "qwen3.5:4b-mlx";

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
  return process.env.OLLAMA_TRANSACTION_MODEL?.trim() || DEFAULT_MODEL;
}

export async function prepareFinancialAssistantStream(
  userId: string,
  workspaceId: string,
  question: string,
): Promise<FinancialAssistantResult> {
  return askFinancialAssistant(userId, workspaceId, question);
}

export async function openOllamaAnswerStream(answer: string): Promise<Response> {
  const response = await fetchWithTimeout(`${ollamaBaseUrl()}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    timeoutProfile: "ollama",
    body: JSON.stringify({
      model: modelName(),
      stream: true,
      think: false,
      keep_alive: "10m",
      options: { temperature: 0.2, num_predict: 600 },
      messages: [
        {
          role: "system",
          content:
            "Reescreves respostas financeiras em português de Portugal, claras e concisas. Não inventes números nem alteres montantes.",
        },
        {
          role: "user",
          content: `Apresenta esta resposta ao utilizador, mantendo os factos:\n\n${answer}`,
        },
      ],
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`OLLAMA_HTTP_${response.status}`);
  }

  return response;
}
