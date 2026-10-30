import { afterEach, describe, expect, it, vi } from "vitest";
import { buildVerifyEmailMessage } from "@/lib/auth/email-templates";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("email-templates", () => {
  it("gera link absoluto de verificação", () => {
    vi.stubEnv("FINTWIN_PUBLIC_URL", "https://app.example");
    const msg = buildVerifyEmailMessage({
      toEmail: "a@example.com",
      token: "abc",
      isEmailChange: true,
    });
    expect(msg.subject).toContain("novo email");
    expect(msg.text).toContain("https://app.example/verificar-email?token=abc");
  });
});
