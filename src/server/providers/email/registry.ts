import type { EmailDeliveryProvider } from "@/server/providers/contracts";
import { smtpEmailProvider } from "@/server/providers/smtp-email-provider";

let cached: EmailDeliveryProvider | null | undefined;

export function resolveEmailDeliveryProvider(): EmailDeliveryProvider | null {
  if (cached === undefined) {
    cached = smtpEmailProvider.isConfigured() ? smtpEmailProvider : null;
  }
  return cached;
}

/** Apenas testes — repõe cache após mudança de env. */
export function resetEmailDeliveryProviderCacheForTests() {
  cached = undefined;
}
