import "server-only";

const DEFAULT_BASE_URL = "http://127.0.0.1:11434";

export function isGlobalLocalAiEnabled(): boolean {
  const flag = process.env.FINTWIN_LOCAL_AI_ENABLED?.trim();
  if (flag === "0" || flag?.toLowerCase() === "false") return false;
  return true;
}

export function resolveOllamaBaseUrl(override?: string | null): string {
  const configured = override?.trim() || process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const url = new URL(configured);
  assertLocalOllamaAllowed(url);
  return url.toString().replace(/\/$/, "");
}

export function assertLocalOllamaAllowed(url: URL): void {
  const localHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
  if (process.env.OLLAMA_ALLOW_REMOTE !== "1" && !localHosts.has(url.hostname)) {
    throw new Error("OLLAMA_REMOTE_DISABLED");
  }
}

export type OllamaHealthResult =
  | { ok: true; models: string[] }
  | { ok: false; error: string };

export async function checkOllamaHealth(baseUrl: string, timeoutMs = 8000): Promise<OllamaHealthResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
    if (!response.ok) {
      return { ok: false, error: `Ollama respondeu com HTTP ${response.status}.` };
    }
    const payload = (await response.json()) as { models?: { name?: string }[] };
    const models = (payload.models ?? [])
      .map((row) => row.name?.trim())
      .filter((name): name is string => Boolean(name));
    return { ok: true, models };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "Tempo esgotado ao contactar o Ollama." };
    }
    return { ok: false, error: "Não foi possível contactar o Ollama neste endereço." };
  } finally {
    clearTimeout(timer);
  }
}
