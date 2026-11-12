import { describe, expect, it } from "vitest";
import { deriveTotpVisualStatus } from "@/lib/auth/totp-visual-status";
import { MFA_TOTP_INVALID_MESSAGE } from "@/lib/auth/totp-messages";

describe("deriveTotpVisualStatus", () => {
  it("mostra verifying quando pending", () => {
    expect(deriveTotpVisualStatus(true, null, 3)).toBe("verifying");
  });

  it("mostra error para código inválido", () => {
    expect(deriveTotpVisualStatus(false, MFA_TOTP_INVALID_MESSAGE, 0)).toBe("error");
  });

  it("mostra success com seis dígitos sem erro", () => {
    expect(deriveTotpVisualStatus(false, null, 6)).toBe("success");
  });
});
