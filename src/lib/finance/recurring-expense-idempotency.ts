import { decimal } from "@/lib/finance/money";

export type ConfirmExpenseOccurrencePayload = {
  occurrenceId: string;
  accountId: string;
  actualAmount: string;
};

export function expenseOccurrenceConfirmMatches(
  stored: {
    id: string;
    accountId: string | null;
    actualAmount: { toString(): string } | null;
  },
  input: ConfirmExpenseOccurrencePayload,
): boolean {
  if (stored.id !== input.occurrenceId) return false;
  const storedAmount = stored.actualAmount?.toString() ?? "";
  const sameAmount =
    decimal(storedAmount || input.actualAmount).toFixed(2) ===
    decimal(input.actualAmount).toFixed(2);
  return storedAmount === "" || sameAmount;
}
