import { describe, expect, it } from "vitest";

import {
  initialAnimatedValue,
  parseAnimatedValue,
  VALUE_TRANSITION_DELAY_MS,
  VALUE_TRANSITION_MS,
} from "./animated-value";

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

  it("mostra o valor real antes de qualquer transição", () => {
    expect(initialAnimatedValue("1 234,56 €")).toBe("1 234,56 €");
    expect(initialAnimatedValue("85,4%")).toBe("85,4%");
    expect(initialAnimatedValue("12")).toBe("12");
    expect(initialAnimatedValue("N/D")).toBe("N/D");
  });
});

describe("animated value timing", () => {
  it("keeps the KPI roll readable after the loading state settles", () => {
    expect(VALUE_TRANSITION_DELAY_MS).toBeGreaterThanOrEqual(100);
    expect(VALUE_TRANSITION_MS).toBeGreaterThanOrEqual(800);
  });
});
