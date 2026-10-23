import { describe, expect, it } from "vitest";
import { monthlyEquivalentAmount } from "@/lib/finance/recurring-monthly";

describe("monthlyEquivalentAmount", () => {
  it("mantém o valor mensal", () => {
    expect(monthlyEquivalentAmount("40.00", "MONTHLY")).toBe("40.00");
  });

  it("normaliza semanal, trimestral e anual", () => {
    expect(monthlyEquivalentAmount("45.00", "WEEKLY")).toBe("195.00");
    expect(monthlyEquivalentAmount("90.00", "QUARTERLY")).toBe("30.00");
    expect(monthlyEquivalentAmount("120.00", "YEARLY")).toBe("10.00");
  });
});
