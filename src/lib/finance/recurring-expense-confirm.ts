export function canConfirmExpenseOccurrence(input: {
  status: string;
  transactionId: string | null;
}):
  | { ok: true; alreadyConfirmed: true }
  | { ok: true; alreadyConfirmed: false }
  | { ok: false; reason: "invalid_status" | "already_paid" } {
  if (input.status === "PAID" || input.transactionId) {
    return { ok: true, alreadyConfirmed: true };
  }
  if (input.status === "SKIPPED" || input.status === "CANCELLED") {
    return { ok: false, reason: "invalid_status" };
  }
  if (input.status === "EXPECTED" || input.status === "POSTPONED") {
    return { ok: true, alreadyConfirmed: false };
  }
  return { ok: false, reason: "invalid_status" };
}
