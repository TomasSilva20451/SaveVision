import { isWithinDuplicateEvidenceWindow } from "@/lib/finance/liability-recurring-duplicate-risk";
import { db } from "@/lib/db";

export async function findRecentLinkedRecurringBankPayment(
  workspaceId: string,
  liabilityId: string,
  around: Date,
): Promise<{ recurringName: string; paidAt: Date } | null> {
  const recurring = await db.recurringExpense.findFirst({
    where: { workspaceId, linkedLiabilityId: liabilityId, status: "ACTIVE" },
  });
  if (!recurring) return null;

  const occurrences = await db.recurringExpenseOccurrence.findMany({
    where: {
      workspaceId,
      recurringExpenseId: recurring.id,
      status: "PAID",
      transactionId: { not: null },
      paidAt: { not: null },
    },
    orderBy: { paidAt: "desc" },
    take: 8,
  });

  for (const row of occurrences) {
    if (row.paidAt && isWithinDuplicateEvidenceWindow(around, row.paidAt)) {
      return { recurringName: recurring.name, paidAt: row.paidAt };
    }
  }
  return null;
}

export async function findRecentLiabilityBankPayment(
  workspaceId: string,
  liabilityId: string,
  around: Date,
): Promise<{ paidAt: Date } | null> {
  const payments = await db.liabilityPayment.findMany({
    where: {
      workspaceId,
      liabilityId,
      principalTransactionId: { not: null },
    },
    orderBy: { paidAt: "desc" },
    take: 8,
  });

  for (const row of payments) {
    if (isWithinDuplicateEvidenceWindow(around, row.paidAt)) {
      return { paidAt: row.paidAt };
    }
  }
  return null;
}
