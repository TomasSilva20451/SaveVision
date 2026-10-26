import { createHmac, timingSafeEqual } from "node:crypto";

export function signWebhookBody(secret: string, timestamp: string, body: string): string {
  const payload = `${timestamp}.${body}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyWebhookSignature(
  secret: string,
  timestamp: string,
  body: string,
  signatureHex: string,
): boolean {
  const expected = signWebhookBody(secret, timestamp, body);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signatureHex, "hex"));
  } catch {
    return false;
  }
}
