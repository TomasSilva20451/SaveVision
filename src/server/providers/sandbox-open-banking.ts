import { createHash } from "node:crypto";
import { civilDateFromInstant, formatCivilDateIso } from "@/lib/datetime/civil-date";
import type { OpenBankingProvider, OpenBankingTransaction } from "@/server/providers/contracts";

/** TPP simulado para demo/E2E — devolve movimentos determinísticos a partir do consentRef. */
export const sandboxOpenBankingProvider: OpenBankingProvider = {
  name: "sandbox-open-banking",
  async fetchTransactions(input) {
    const seed = createHash("sha256").update(input.consentRef).digest("hex");
    const today = formatCivilDateIso(civilDateFromInstant(new Date()));
    const cents = Number.parseInt(seed.slice(0, 6), 16) % 10_000;
    const signed = seed.charCodeAt(0) % 2 === 0 ? -cents : cents;
    const amount = (signed / 100).toFixed(2);

    return [
      {
        externalId: `sandbox-${seed.slice(0, 12)}`,
        bookingDate: today,
        amount,
        currency: "EUR",
        description: `Sandbox OB ${input.accountExternalRef}`,
        counterparty: "Sandbox TPP",
      },
    ] satisfies OpenBankingTransaction[];
  },
};
