import "server-only";

const DEFAULT_BASE_URL = "http://127.0.0.1:11434";

export function ollamaBaseUrlForReceipt(): string {
  const configured = process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const url = new URL(configured);
  const localHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);

  if (process.env.OLLAMA_ALLOW_REMOTE !== "1" && !localHosts.has(url.hostname)) {
    throw new Error("OLLAMA_REMOTE_DISABLED");
  }

  return url.toString().replace(/\/$/, "");
}
