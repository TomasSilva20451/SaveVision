import { describe, expect, it } from "vitest";
import {
  canSubmitTotpManually,
  isTotpComplete,
  normalizeTotpDigits,
  shouldAutoSubmitTotp,
} from "@/lib/auth/totp-auto-submit";

describe("totp-auto-submit", () => {
  it("não considera completo com cinco dígitos", () => {
    expect(isTotpComplete("12345")).toBe(false);
    expect(shouldAutoSubmitTotp("12345", null)).toBe(false);
  });

  it("dispara uma vez para seis dígitos", () => {
    expect(shouldAutoSubmitTotp("123456", null)).toBe(true);
    expect(shouldAutoSubmitTotp("123456", "123456")).toBe(false);
  });

  it("normaliza colagem e autofill", () => {
    expect(normalizeTotpDigits("12 34-56")).toBe("123456");
    expect(shouldAutoSubmitTotp("12 34-56", null)).toBe(true);
  });

  it("permite nova tentativa automática após alteração", () => {
    expect(shouldAutoSubmitTotp("654321", "123456")).toBe(true);
  });

  it("botão manual exige seis dígitos e ausência de pending", () => {
    expect(canSubmitTotpManually("123456", false)).toBe(true);
    expect(canSubmitTotpManually("123456", true)).toBe(false);
    expect(canSubmitTotpManually("12345", false)).toBe(false);
  });
});
