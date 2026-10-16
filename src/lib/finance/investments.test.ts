import { describe, expect, it } from "vitest";
import {
  positionMarketValue,
  positionReturnPercent,
  positionUnrealizedPnl,
} from "@/lib/finance/investments";

describe("investments", () => {
  it("calcula valor e P/L", () => {
    expect(positionMarketValue("10", "25")).toBe("250.00");
    expect(positionUnrealizedPnl("10", "25", "200")).toBe("50.00");
    expect(positionReturnPercent("10", "25", "200")).toBe(25);
  });
});
