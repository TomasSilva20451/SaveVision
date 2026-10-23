import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const MAGIC = Buffer.from("FTENC01", "ascii");

export type EncryptionKey = { id: string; key: Buffer };

export function encryptionKeyFromEnvironment(env = process.env): EncryptionKey {
  const environment = env.FINTWIN_ENV ?? "development";
  const configured = env.FINTWIN_DOCUMENT_ENCRYPTION_KEY?.trim();
  const id = env.FINTWIN_DOCUMENT_ENCRYPTION_KEY_ID?.trim() || `${environment}-development-fallback`;
  if (configured) {
    const decoded = Buffer.from(configured, "base64");
    if (decoded.length !== 32) throw new Error("DOCUMENT_ENCRYPTION_KEY_INVALID");
    return { id, key: decoded };
  }
  const fallback = env.AUTH_SECRET;
  if (!fallback || fallback.length < 32) throw new Error("DOCUMENT_ENCRYPTION_KEY_MISSING");
  return { id, key: createHash("sha256").update(`documents:${fallback}`).digest() };
}

export function isEncryptedEnvelope(bytes: Uint8Array): boolean {
  const value = Buffer.from(bytes);
  return value.length > MAGIC.length && value.subarray(0, MAGIC.length).equals(MAGIC);
}

export function encryptEnvelope(plain: Uint8Array, encryption: EncryptionKey): Uint8Array {
  const keyId = Buffer.from(encryption.id, "utf8");
  if (keyId.length < 1 || keyId.length > 255) throw new Error("DOCUMENT_ENCRYPTION_KEY_ID_INVALID");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryption.key, iv);
  cipher.setAAD(keyId);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, Buffer.from([keyId.length]), keyId, iv, tag, ciphertext]);
}

export function decryptEnvelope(payload: Uint8Array, keys: EncryptionKey[]): Uint8Array {
  const bytes = Buffer.from(payload);
  if (!isEncryptedEnvelope(bytes)) throw new Error("DOCUMENT_NOT_ENCRYPTED");
  const keyIdLength = bytes[MAGIC.length];
  const keyIdStart = MAGIC.length + 1;
  const keyIdEnd = keyIdStart + keyIdLength;
  const keyId = bytes.subarray(keyIdStart, keyIdEnd).toString("utf8");
  const encryption = keys.find((candidate) => candidate.id === keyId);
  if (!encryption) throw new Error(`DOCUMENT_ENCRYPTION_KEY_UNKNOWN:${keyId}`);
  const iv = bytes.subarray(keyIdEnd, keyIdEnd + 12);
  const tag = bytes.subarray(keyIdEnd + 12, keyIdEnd + 28);
  const ciphertext = bytes.subarray(keyIdEnd + 28);
  const decipher = createDecipheriv("aes-256-gcm", encryption.key, iv);
  decipher.setAAD(Buffer.from(keyId, "utf8"));
  decipher.setAuthTag(tag);
  return new Uint8Array(Buffer.concat([decipher.update(ciphertext), decipher.final()]));
}

