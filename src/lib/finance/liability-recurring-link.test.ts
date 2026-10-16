import { describe, expect, it } from "vitest";
import {
  assertSingleActiveLinkPerLiability,
  describeRecurringLiabilityMismatch,
  validatePaymentDueDayInput,
} from "@/lib/finance/liability-recurring-link";
import { startOfCivilDay } from "@/lib/datetime/civil-date";
import { generateLiabilityMonthlyOutflows } from "@/lib/finance/treasury-liability-events";

describe("liability-recurring-link", () => {
  it("aceita dia 1–31 e rejeita inválidos", () => {
    expect(validatePaymentDueDayInput("10")).toEqual({ ok: true, day: 10 });
    expect(validatePaymentDueDayInput("")).toEqual({ ok: true, day: null });
    expect(validatePaymentDueDayInput("32").ok).toBe(false);
  });

  it("dia 31 em fevereiro usa último dia válido na agenda", () => {
    const events = generateLiabilityMonthlyOutflows({
      liabilityId: "l1",
      title: "Crédito",
      monthlyPayment: "600",
      outstandingBalance: "100000",
      scheduleAnchor: { year: 2026, month: 1, day: 31 },
      paymentDueDayOfMonth: 31,
      horizonStart: startOfCivilDay({ year: 2026, month: 2, day: 1 }),
      horizonEnd: startOfCivilDay({ year: 2026, month: 3, day: 1 }),
    });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]?.dueDate).toBeDefined();
  });

  it("detecta diferença de montante", () => {
    const msg = describeRecurringLiabilityMismatch({
      recurringStatus: "ACTIVE",
      recurringFrequency: "MONTHLY",
      recurringAmount: "600",
      linkedLiabilityId: "x",
      liabilityMonthlyPayment: "650",
      liabilityOutstanding: "10000",
    });
    expect(msg).toMatch(/difere/);
  });

  it("recorrência pausada avisa", () => {
    const msg = describeRecurringLiabilityMismatch({
      recurringStatus: "PAUSED",
      recurringFrequency: "MONTHLY",
      recurringAmount: "600",
      linkedLiabilityId: "x",
      liabilityMonthlyPayment: "600",
      liabilityOutstanding: "10000",
    });
    expect(msg).toMatch(/pausada/);
  });

  it("bloqueia segunda recorrência activa no mesmo passivo", () => {
    const err = assertSingleActiveLinkPerLiability(
      [{ liabilityId: "l1", recurringId: "r1", status: "ACTIVE" }],
      "l1",
      "r2",
    );
    expect(err).toBeTruthy();
  });
});
