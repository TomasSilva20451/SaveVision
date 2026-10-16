import { describe, expect, it } from "vitest";
import { sessionCookie } from "@/lib/auth/session-cookie";

describe("sessionCookie", () => {
  it("mantém o cookie HttpOnly e só o marca Secure em produção", () => {
    const development = sessionCookie("development");
    const production = sessionCookie("production");

    expect(development.options.httpOnly).toBe(true);
    expect(development.options.sameSite).toBe("lax");
    expect(development.options.secure).toBe(false);
    expect(production.options.httpOnly).toBe(true);
    expect(production.options.secure).toBe(true);
    expect(production.name.startsWith("__Secure-")).toBe(true);
  });
});
