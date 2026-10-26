import type { OpenBankingProvider, OpenBankingTransaction } from "@/server/providers/contracts";

/** Importação manual / demo — sem ligação a TPP real. */
export const manualBankFeedProvider: OpenBankingProvider = {
  name: "manual-bank-feed",
  async fetchTransactions() {
    return [] as OpenBankingTransaction[];
  },
};
