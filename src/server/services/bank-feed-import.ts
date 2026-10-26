import { detectDuplicateBankLines } from "@/lib/finance/bank-reconciliation";
import type { ParsedBankFeedRow } from "@/lib/finance/bank-feed-csv";
import { decimal } from "@/lib/finance/money";
import { db } from "@/lib/db";

export async function importBankFeedRows(
  workspaceId: string,
  accountId: string,
  rows: ParsedBankFeedRow[],
): Promise<{ imported: number; duplicates: number }> {
  if (rows.length === 0) return { imported: 0, duplicates: 0 };

  return db.$transaction(async (tx) => {
    let imported = 0;
    for (const row of rows) {
      try {
        await tx.bankFeedLine.create({
          data: {
            workspaceId,
            accountId,
            externalId: row.externalId,
            bookingDate: row.bookingDate,
            amount: decimal(row.amount),
            description: row.description,
            counterpartyHash: row.counterpartyHash,
          },
        });
        imported++;
      } catch {
        // externalId único — ignorar reimportação
      }
    }

    const allLines = await tx.bankFeedLine.findMany({
      where: { workspaceId, accountId, status: "UNMATCHED" },
      select: { id: true, externalId: true, amount: true, bookingDate: true, counterpartyHash: true },
    });
    const dupMap = detectDuplicateBankLines(
      allLines.map((l) => ({
        id: l.id,
        externalId: l.externalId,
        amount: l.amount.toString(),
        bookingDate: l.bookingDate,
        counterpartyHash: l.counterpartyHash,
      })),
    );
    for (const [lineId, originalId] of dupMap) {
      await tx.bankFeedLine.update({
        where: { id: lineId },
        data: { status: "DUPLICATE", duplicateOfId: originalId },
      });
    }

    return { imported, duplicates: dupMap.size };
  });
}
