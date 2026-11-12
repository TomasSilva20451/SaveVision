import { describe, expect, it } from "vitest";
import { buildLoginMfaFormData } from "@/lib/auth/login-mfa-form";
import { normalizeTotpDigits } from "@/lib/auth/totp-auto-submit";

describe("buildLoginMfaFormData", () => {
  it("normaliza o código TOTP antes de enviar", () => {
    expect(normalizeTotpDigits("12 34-56")).toBe("123456");
  });

  it("define totp normalizado independentemente do input", () => {
    if (typeof document === "undefined") return;
    const form = document.createElement("form");
    form.innerHTML = `
      <input name="intent" value="mfa" />
      <input name="totp" value="" />
    `;
    document.body.appendChild(form);
    const fd = buildLoginMfaFormData(form, "12 34-56");
    expect(fd.get("totp")).toBe("123456");
    form.remove();
  });
});
