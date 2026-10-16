export type OccurrenceStatus =
  | "EXPECTED"
  | "RECEIVED"
  | "MISSED"
  | "CANCELLED";

export type ConfirmOccurrenceInput = {
  status: OccurrenceStatus;
  transactionId: string | null;
};

export type ConfirmOccurrenceResult =
  | { ok: true; alreadyConfirmed: boolean }
  | { ok: false; reason: "not_expected" | "cancelled" | "missed" };

/** Confirmar receção é idempotente quando já existe transactionId. */
export function canConfirmOccurrence(input: ConfirmOccurrenceInput): ConfirmOccurrenceResult {
  if (input.status === "RECEIVED" && input.transactionId) {
    return { ok: true, alreadyConfirmed: true };
  }

  if (input.status !== "EXPECTED") {
    if (input.status === "CANCELLED") return { ok: false, reason: "cancelled" };
    if (input.status === "MISSED") return { ok: false, reason: "missed" };
    return { ok: true, alreadyConfirmed: true };
  }

  return { ok: true, alreadyConfirmed: false };
}
