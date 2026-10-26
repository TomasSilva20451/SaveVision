import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function encryptionKey(env = process.env): Buffer {
  const material =
    env.FINTWIN_WEBHOOK_ENCRYPTION_KEY ??
    env.AUTH_SECRET ??
    "fintwin-non-production-webhook-key-32";
  return createHash("sha256").update(material).digest();
}

export function encryptWebhookSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptWebhookSecret(encoded: string): string {
  const buf = Buffer.from(encoded, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
