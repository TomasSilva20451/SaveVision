export type DocumentProbeResult = "OK" | "MISSING" | "DECRYPT_FAIL";

export function classifyReadError(error: unknown): DocumentProbeResult {
  const message = error instanceof Error ? error.message : String(error);
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "ENOENT" || message.includes("ENOENT") || message.includes("OBJECT_STORAGE_404")) {
    return "MISSING";
  }
  if (
    message.includes("DOCUMENT_NOT_ENCRYPTED") ||
    message.toLowerCase().includes("decrypt") ||
    message.includes("auth tag")
  ) {
    return "DECRYPT_FAIL";
  }
  return "MISSING";
}
