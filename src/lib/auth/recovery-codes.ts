import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(5).toString("hex").toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}

export function recoveryCodeMatches(code: string, codeHash: string): boolean {
  const actual = Buffer.from(hashRecoveryCode(code));
  const expected = Buffer.from(codeHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}
