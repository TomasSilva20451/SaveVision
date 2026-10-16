import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("hashPassword", () => {
  it("guarda Argon2id e nunca a palavra-passe em claro", async () => {
    const password = "demo-joao-2026";
    const hash = await hashPassword(password);

    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).not.toContain(password);
    expect(await verifyPassword(hash, password)).toBe(true);
    expect(await verifyPassword(hash, "outra-palavra")).toBe(false);
  });
});
