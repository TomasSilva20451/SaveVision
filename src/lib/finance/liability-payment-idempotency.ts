import { decimal } from "@/lib/finance/money";

export type LiabilityPaymentPayload = {
  liabilityId: string;
  principalAmount: string;
  interestAmount: string;
  feesAmount: string;
  accountId?: string | null;
  mode: "LIABILITY_ONLY" | "WITH_BANK";
};

export function liabilityPaymentPayloadMatches(
  stored: {
    liabilityId: string;
    principalAmount: { toString(): string };
    interestAmount: { toString(): string };
    feesAmount: { toString(): string };
    accountId: string | null;
  },
  input: LiabilityPaymentPayload,
): boolean {
  const samePrincipal =
    decimal(stored.principalAmount.toString()).toFixed(2) ===
    decimal(input.principalAmount).toFixed(2);
  const sameInterest =
    decimal(stored.interestAmount.toString()).toFixed(2) ===
    decimal(input.interestAmount).toFixed(2);
  const sameFees =
    decimal(stored.feesAmount.toString()).toFixed(2) ===
    decimal(input.feesAmount).toFixed(2);

  const expectedAccount =
    input.mode === "WITH_BANK" ? (input.accountId ?? null) : null;

  return (
    stored.liabilityId === input.liabilityId &&
    samePrincipal &&
    sameInterest &&
    sameFees &&
    stored.accountId === expectedAccount
  );
}
