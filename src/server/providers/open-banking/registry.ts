import type { OpenBankingProvider } from "@/server/providers/contracts";
import { createHttpOpenBankingProvider } from "@/server/providers/http-open-banking";
import { manualBankFeedProvider } from "@/server/providers/manual-bank-feed";
import { sandboxOpenBankingProvider } from "@/server/providers/sandbox-open-banking";

const staticProviders: Record<string, OpenBankingProvider> = {
  [manualBankFeedProvider.name]: manualBankFeedProvider,
  [sandboxOpenBankingProvider.name]: sandboxOpenBankingProvider,
};

export function resolveOpenBankingProvider(providerName: string): OpenBankingProvider | null {
  if (staticProviders[providerName]) return staticProviders[providerName];
  if (providerName === "http-open-banking") {
    return createHttpOpenBankingProvider();
  }
  return null;
}

export function listConfiguredOpenBankingProviders(): string[] {
  const names = Object.keys(staticProviders);
  if (createHttpOpenBankingProvider()) names.push("http-open-banking");
  return names;
}
