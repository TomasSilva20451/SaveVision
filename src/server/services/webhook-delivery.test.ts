import { describe, expect, it } from "vitest";
import { signWebhookBody, verifyWebhookSignature } from "@/lib/corporate/webhook-hmac";

describe("webhook HMAC", () => {
  it("assina e verifica payload", () => {
    const body = JSON.stringify({ event: "reconciliation.matched" });
    const ts = "1700000000";
    const sig = signWebhookBody("segredo-teste", ts, body);
    expect(verifyWebhookSignature("segredo-teste", ts, body, sig)).toBe(true);
    expect(verifyWebhookSignature("outro", ts, body, sig)).toBe(false);
  });
});
