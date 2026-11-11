import { describe, expect, it } from "vitest";
import { findPrivateAmountRanges, isPrivateAmount } from "@/lib/ui/privacy-sensitive";

describe("isPrivateAmount", () => {
  it("reconhece um montante isolado", () => {
    expect(isPrivateAmount("90,49 €")).toBe(true);
    expect(isPrivateAmount("− 1 431 600,00 €")).toBe(true);
    expect(isPrivateAmount("-39 729,18 €")).toBe(true);
    expect(isPrivateAmount("-40k €")).toBe(true);
  });

  it("ignora texto sem montante", () => {
    expect(isPrivateAmount("novembro de 2026")).toBe(false);
    expect(isPrivateAmount("+86%")).toBe(false);
    expect(isPrivateAmount("Modo seguro")).toBe(false);
    expect(isPrivateAmount("")).toBe(false);
  });
});

describe("findPrivateAmountRanges", () => {
  it("encontra o montante no meio de uma frase", () => {
    const text = "o saldo poderá atingir -39341.18 € durante os próximos 30 dias (10.00 €).";
    const ranges = findPrivateAmountRanges(text);
    expect(ranges.map((range) => text.slice(range.start, range.end))).toEqual(["-39341.18 €", "10.00 €"]);
    expect(isPrivateAmount(text)).toBe(false);
  });
});
