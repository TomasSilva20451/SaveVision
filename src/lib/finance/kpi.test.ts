import { describe, expect, it } from "vitest";
import { safePercentChange } from "@/lib/finance/kpi";

describe("safePercentChange", () => {
  it("evita divisão por zero", () => {
    expect(safePercentChange("100", "0")).toBeNull();
  });

  it("calcula variação percentual", () => {
    expect(safePercentChange("120", "100")).toBe(20);
    expect(safePercentChange("80", "100")).toBe(-20);
  });
});
