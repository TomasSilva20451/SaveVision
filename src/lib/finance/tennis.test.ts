import { describe, expect, it } from "vitest";
import { calculateTennisNetPrize } from "@/lib/finance/tennis";

describe("calculateTennisNetPrize", () => {
  it("desconta custos do prémio bruto", () => {
    const net = calculateTennisNetPrize({
      grossPrize: "500",
      registrationFee: "25",
      travelCost: "40",
      accommodationCost: "60",
      foodCost: "15",
      otherCosts: "10",
    });

    expect(net.toFixed(2)).toBe("350.00");
  });
});
