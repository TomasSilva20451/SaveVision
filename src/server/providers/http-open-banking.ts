import type { OpenBankingProvider, OpenBankingTransaction } from "@/server/providers/contracts";

type HttpObConfig = {
  baseUrl: string;
  apiKey?: string;
};

function resolveHttpOpenBankingConfig(): HttpObConfig | null {
  const baseUrl = process.env.FINTWIN_OPEN_BANKING_BASE_URL?.trim();
  if (!baseUrl) return null;
  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey: process.env.FINTWIN_OPEN_BANKING_API_KEY?.trim(),
  };
}

/** Adaptador HTTP read-only para um agregador/TTP configurado por ambiente. */
export function createHttpOpenBankingProvider(): OpenBankingProvider | null {
  const config = resolveHttpOpenBankingConfig();
  if (!config) return null;

  return {
    name: "http-open-banking",
    async fetchTransactions(input) {
      const url = new URL(`${config.baseUrl}/accounts/${encodeURIComponent(input.accountExternalRef)}/transactions`);
      url.searchParams.set("from", input.from);
      url.searchParams.set("to", input.to);

      const headers: Record<string, string> = {
        Accept: "application/json",
        Authorization: `Bearer ${input.consentRef}`,
      };
      if (config.apiKey) headers["X-Api-Key"] = config.apiKey;

      const response = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
      if (!response.ok) {
        throw new Error(`OPEN_BANKING_HTTP_${response.status}`);
      }

      const body = (await response.json()) as { transactions?: OpenBankingTransaction[] };
      return body.transactions ?? [];
    },
    async refreshConsent(input) {
      const url = `${config.baseUrl}/consents/${encodeURIComponent(input.consentRef)}/refresh`;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (config.apiKey) headers["X-Api-Key"] = config.apiKey;
      const response = await fetch(url, { method: "POST", headers, signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`OPEN_BANKING_REFRESH_${response.status}`);
      const body = (await response.json()) as { consentRef?: string; expiresAt?: string };
      return { consentRef: body.consentRef ?? input.consentRef, expiresAt: body.expiresAt };
    },
    async revokeConsent(input) {
      const url = `${config.baseUrl}/consents/${encodeURIComponent(input.consentRef)}`;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (config.apiKey) headers["X-Api-Key"] = config.apiKey;
      const response = await fetch(url, { method: "DELETE", headers, signal: AbortSignal.timeout(15_000) });
      if (!response.ok && response.status !== 404) throw new Error(`OPEN_BANKING_REVOKE_${response.status}`);
    },
  };
}
