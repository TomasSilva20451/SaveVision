import { describe, expect, it } from "vitest";
import {
  addMoney,
  decimal,
  formatEUR,
  normalizeDecimalInput,
  roundMoney,
} from "@/lib/finance/money";

const NBSP = "\u00a0";

describe("formatEUR", () => {
  it("formata euros em pt-PT com agrupamento e símbolo", () => {
    expect(formatEUR("1234.56")).toBe(`1${NBSP}234,56${NBSP}€`);
    expect(formatEUR("1234567.8")).toBe(`1${NBSP}234${NBSP}567,80${NBSP}€`);
  });

  it("arredonda half-up a duas casas, incluindo valores negativos", () => {
    expect(roundMoney("1.005").toFixed(2)).toBe("1.01");
    expect(roundMoney("1.004").toFixed(2)).toBe("1.00");
    expect(roundMoney("1.225").toFixed(2)).toBe("1.23");
    expect(roundMoney("-1.235").toFixed(2)).toBe("-1.24");
    expect(formatEUR("1.005")).toBe(`1,01${NBSP}€`);
    expect(formatEUR("-1.235")).toBe(`-1,24${NBSP}€`);
  });
});

describe("addMoney", () => {
  it("soma cêntimos com Decimal, sem o erro de vírgula flutuante", () => {
    const pennies = Array.from({ length: 100 }, () => "0.01");

    expect(addMoney(["0.1", "0.2"]).equals("0.3")).toBe(true);
    expect(addMoney(pennies).equals("1.00")).toBe(true);
    expect(addMoney(["10.10", "0.20"]).equals("10.30")).toBe(true);
  });
});

describe("normalizeDecimalInput", () => {
  it("aceita vírgula e ponto como separador decimal", () => {
    expect(normalizeDecimalInput("45,60")).toBe("45.60");
    expect(normalizeDecimalInput("45.60")).toBe("45.60");
    expect(decimal("-12,5").toFixed(2)).toBe("-12.50");
  });

  it("aceita os formatos comuns com separador de milhares", () => {
    expect(normalizeDecimalInput("1.234,56")).toBe("1234.56");
    expect(normalizeDecimalInput("1,234.56")).toBe("1234.56");
    expect(normalizeDecimalInput("1 234,56")).toBe("1234.56");
  });

  it("rejeita valores vazios ou malformados", () => {
    expect(() => normalizeDecimalInput("")).toThrow("Montante vazio");
    expect(() => normalizeDecimalInput("12,3,4")).toThrow("Montante inválido");
    expect(() => normalizeDecimalInput("12 euros")).toThrow("Montante inválido");
  });
});
