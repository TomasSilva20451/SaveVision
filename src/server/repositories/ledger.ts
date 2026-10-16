import { db } from "@/lib/db";
import type { LedgerMovement } from "@/lib/finance/types";

export async function listWorkspaceMovements(
  workspaceId: string,
): Promise<LedgerMovement[]> {
  const rows = await db.transaction.findMany({
    where: { workspaceId, deletedAt: null },
    select: {
      accountId: true,
      type: true,
      status: true,
      amount: true,
      deletedAt: true,
    },
  });

  return rows.map((row) => ({
    accountId: row.accountId,
    type: row.type,
    status: row.status,
    amount: row.amount.toString(),
    deletedAt: row.deletedAt,
  }));
}
