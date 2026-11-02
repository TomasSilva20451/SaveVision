export type FetchTimeoutProfile = "ollama" | "ollamaVision" | "ollamaNarrative" | "banking" | "webhook";

const TIMEOUT_MS: Record<FetchTimeoutProfile, number> = {
  ollama: 45_000,
  ollamaNarrative: 90_000,
  ollamaVision: 120_000,
  banking: 15_000,
  webhook: 10_000,
};

export type FetchWithTimeoutInit = RequestInit & {
  timeoutProfile?: FetchTimeoutProfile;
  timeoutMs?: number;
};

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: FetchWithTimeoutInit = {},
): Promise<Response> {
  const { timeoutProfile, timeoutMs, signal: externalSignal, ...rest } = init;
  const ms =
    timeoutMs ??
    (timeoutProfile ? TIMEOUT_MS[timeoutProfile] : TIMEOUT_MS.ollama);

  if (externalSignal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  return fetch(input, {
    ...rest,
    signal: AbortSignal.any([
      AbortSignal.timeout(ms),
      ...(externalSignal ? [externalSignal] : []),
    ]),
  });
}
