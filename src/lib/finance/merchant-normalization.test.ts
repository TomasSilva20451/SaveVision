import { describe, expect, it } from "vitest";
import { normalizeMerchant, normalizeMerchantSearchPattern } from "@/lib/finance/merchant-normalization";

describe("merchant-normalization", () => {
  it("remove acentos e números de loja", () => {
    expect(normalizeMerchantSearchPattern("Continente Lisboa 123")).toBe("CONTINENTE LISBOA");
  });

  it("filtra ruído bancário", () => {
    expect(normalizeMerchantSearchPattern("MB WAY PAG CONTINENTE")).toContain("CONTINENTE");
    expect(normalizeMerchantSearchPattern("MB WAY PAG CONTINENTE")).not.toContain("MB");
  });

  it("display label em title case", () => {
    expect(normalizeMerchant("continente lisboa").displayLabel).toBe("Continente Lisboa");
  });

  it("string vazia", () => {
    expect(normalizeMerchant("").searchPattern).toBe("");
    expect(normalizeMerchant("   ").displayLabel).toBe("Comerciante");
  });
});
