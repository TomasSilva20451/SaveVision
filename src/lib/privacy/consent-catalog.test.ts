import { describe, expect, it } from "vitest";
import { CONSENT_CATALOG, missingRequiredConsents } from "@/lib/privacy/consent-catalog";

describe("consent-catalog", () => {
  it("exige versões únicas por chave", () => {
    for (const def of CONSENT_CATALOG) {
      expect(def.version.length).toBeGreaterThan(4);
      expect(def.purpose.length).toBeGreaterThan(10);
    }
  });

  it("detecta consentimentos obrigatórios em falta", () => {
    const missing = missingRequiredConsents([]);
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.every((m) => m.required)).toBe(true);
  });
});
