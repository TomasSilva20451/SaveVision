import { describe, expect, it } from "vitest";
import { decryptEnvelope, encryptEnvelope, isEncryptedEnvelope } from "@/server/security/envelope-encryption";

describe("document envelope encryption", () => {
  const encryption = { id: "test-v1", key: Buffer.alloc(32, 7) };

  it("cifra e decifra com AES-256-GCM", () => {
    const plain = new TextEncoder().encode("documento financeiro privado");
    const encrypted = encryptEnvelope(plain, encryption);
    expect(isEncryptedEnvelope(encrypted)).toBe(true);
    expect(new TextDecoder().decode(decryptEnvelope(encrypted, [encryption]))).toBe("documento financeiro privado");
  });

  it("recusa conteúdo adulterado", () => {
    const encrypted = encryptEnvelope(new Uint8Array([1, 2, 3]), encryption);
    encrypted[encrypted.length - 1] ^= 1;
    expect(() => decryptEnvelope(encrypted, [encryption])).toThrow();
  });
});

