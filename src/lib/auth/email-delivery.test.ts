import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canRevealEmailVerificationLinksInUi,
  isSmtpEmailDeliveryConfigured,
} from "@/lib/auth/email-delivery";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("email-delivery", () => {
  it("treats missing SMTP as not configured", () => {
    vi.stubEnv("SMTP_HOST", "");
    expect(isSmtpEmailDeliveryConfigured()).toBe(false);
    expect(canRevealEmailVerificationLinksInUi()).toBe(true);
  });

  it("hides in-app links in production when SMTP is set", () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FINTWIN_ENV", "production");
    vi.stubEnv("FINTWIN_EMAIL_DEV_LINKS", "");
    expect(canRevealEmailVerificationLinksInUi()).toBe(false);
  });

  it("allows override with FINTWIN_EMAIL_DEV_LINKS", () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FINTWIN_ENV", "production");
    vi.stubEnv("FINTWIN_EMAIL_DEV_LINKS", "1");
    expect(canRevealEmailVerificationLinksInUi()).toBe(true);
  });
});
