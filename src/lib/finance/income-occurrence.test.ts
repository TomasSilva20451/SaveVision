import { describe, expect, it } from "vitest";
import { canConfirmOccurrence } from "@/lib/finance/income-occurrence";

describe("canConfirmOccurrence", () => {
  it("permite confirmar apenas EXPECTED", () => {
    expect(
      canConfirmOccurrence({ status: "EXPECTED", transactionId: null }),
    ).toEqual({ ok: true, alreadyConfirmed: false });
  });

  it("é idempotente quando já recebida", () => {
    expect(
      canConfirmOccurrence({ status: "RECEIVED", transactionId: "tx-1" }),
    ).toEqual({ ok: true, alreadyConfirmed: true });
  });

  it("recusa cancelada ou em falta", () => {
    expect(
      canConfirmOccurrence({ status: "CANCELLED", transactionId: null }),
    ).toEqual({ ok: false, reason: "cancelled" });
    expect(
      canConfirmOccurrence({ status: "MISSED", transactionId: null }),
    ).toEqual({ ok: false, reason: "missed" });
  });
});
