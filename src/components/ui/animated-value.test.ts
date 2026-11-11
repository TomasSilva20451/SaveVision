import { describe, expect, it } from "vitest";

import { parseAnimatedValue } from "./animated-value";

describe("parseAnimatedValue", () => {
  it("lê montantes formatados em pt-PT", () => {
    expect(parseAnimatedValue("1 234,56 €")).toEqual({
      numeric: 1234.56,
      kind: "currency",
      fractionDigits: 2,
    });
  });

  it("lê percentagens e contagens", () => {
    expect(parseAnimatedValue("85,4%")).toEqual({
      numeric: 85.4,
      kind: "percent",
      fractionDigits: 1,
    });
    expect(parseAnimatedValue("12")).toEqual({
      numeric: 12,
      kind: "number",
      fractionDigits: 0,
    });
  });

  it("não tenta animar estados textuais", () => {
    expect(parseAnimatedValue("Dados insuficientes")).toBeNull();
    expect(parseAnimatedValue("N/D")).toBeNull();
  });
});
