import { describe, expect, it } from "vitest";
import { generateRecoveryCodes, hashRecoveryCode, recoveryCodeMatches } from "@/lib/auth/recovery-codes";
import {
  ACCOUNT_MAX_FAILURES,
  STUFFING_DISTINCT_ACCOUNTS,
  recordScopedFailure,
} from "@/lib/auth/distributed-rate-limit";
import { generateTotpSecret, verifyTotpCode } from "@/lib/auth/totp";
import { createHmac } from "node:crypto";

function codeAt(secret: string, counter: number): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of secret) {
    const index = alphabet.indexOf(char);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const key = Buffer.from(bytes);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(buffer).digest();
  const offset = digest[digest.length - 1]! & 0xf;
  const binary = ((digest[offset]! & 0x7f) << 24) | ((digest[offset + 1]! & 0xff) << 16) | ((digest[offset + 2]! & 0xff) << 8) | (digest[offset + 3]! & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

describe("account security primitives", () => {
  it("aceita o código TOTP do intervalo actual", () => {
    const secret = generateTotpSecret();
    const counter = Math.floor(Date.now() / 30_000);
    expect(verifyTotpCode(secret, codeAt(secret, counter))).toBe(true);
    expect(verifyTotpCode(secret, "000000")).toBe(false);
  });

  it("confirma códigos de recuperação só uma vez pela hash", () => {
    const [code] = generateRecoveryCodes(1);
    const hash = hashRecoveryCode(code!);
    expect(recoveryCodeMatches(code!, hash)).toBe(true);
    expect(recoveryCodeMatches("ZZZZZ-ZZZZZ", hash)).toBe(false);
  });

  it("bloqueia a conta ao fim de 5 falhas e detecta credential stuffing por IP", () => {
    let bucket: ReturnType<typeof recordScopedFailure>["bucket"] | undefined;
    for (let attempt = 0; attempt < ACCOUNT_MAX_FAILURES; attempt += 1) {
      const decision = recordScopedFailure(bucket, 1_000 + attempt, {
        scope: "account",
        maxFailures: ACCOUNT_MAX_FAILURES,
        blockMs: 1_000,
      });
      bucket = decision.bucket;
    }
    expect(bucket?.blockedUntil).not.toBeNull();

    let ip: ReturnType<typeof recordScopedFailure>["bucket"] | undefined;
    let stuffing = false;
    for (let account = 0; account < STUFFING_DISTINCT_ACCOUNTS; account += 1) {
      const decision = recordScopedFailure(ip, 5_000, {
        scope: "ip",
        maxFailures: 30,
        blockMs: 1_000,
        subject: `mail-${account}`,
        stuffingAt: STUFFING_DISTINCT_ACCOUNTS,
      });
      ip = decision.bucket;
      stuffing = decision.reason === "stuffing";
    }
    expect(stuffing).toBe(true);
  });
});
