import { describe, expect, it } from "vitest";
import { calculateEcommerceNetProceeds } from "@/lib/finance/ecommerce";

describe("calculateEcommerceNetProceeds", () => {
  it("calcula líquido e reserva de planeamento", () => {
    const result = calculateEcommerceNetProceeds({
      grossAmount: "100",
      marketplaceFees: "8",
      shippingCost: "6.5",
      otherCosts: "2",
      taxReservePercentage: "10",
    });

    expect(result.netProceeds.toFixed(2)).toBe("83.50");
    expect(result.taxReserveAmount.toFixed(2)).toBe("8.35");
  });
});
