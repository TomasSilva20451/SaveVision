import { describe, expect, it } from "vitest";
import { parseDisplayAmount } from "./parse-display-amount";

describe("parseDisplayAmount", () => {
  it("interpreta montantes do domínio", () => {
    expect(parseDisplayAmount("150", false)).toBe(150);
    expect(parseDisplayAmount("4179.50", false)).toBe(4179.5);
  });

  it("interpreta EUR formatado", () => {
    expect(parseDisplayAmount("4.179,50 €", true)).toBe(4179.5);
  });
});
