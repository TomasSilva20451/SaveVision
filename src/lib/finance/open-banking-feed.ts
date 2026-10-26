import { createHash } from "node:crypto";
import { parseCivilDateIso, startOfCivilDay } from "@/lib/datetime/civil-date";
import { decimal } from "@/lib/finance/money";
import type { ParsedBankFeedRow } from "@/lib/finance/bank-feed-csv";
import type { OpenBankingTransaction } from "@/server/providers/contracts";

function hashCounterparty(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 16);
}

export function mapOpenBankingTransactions(rows: OpenBankingTransaction[]): ParsedBankFeedRow[] {
  return rows.map((row) => {
    const civil = parseCivilDateIso(row.bookingDate.slice(0, 10));
    const description = row.description.trim() || "Movimento Open Banking";
    return {
      externalId: row.externalId,
      bookingDate: startOfCivilDay(civil),
      amount: decimal(row.amount).toFixed(4),
      description,
      counterpartyHash: row.counterparty ? hashCounterparty(row.counterparty) : hashCounterparty(description),
    };
  });
}
