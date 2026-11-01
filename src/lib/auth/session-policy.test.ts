import { describe, expect, it } from "vitest";
import {
  SESSION_ABSOLUTE_SECONDS,
  absoluteSessionExpired,
  isPublicAuthPath,
} from "@/lib/auth/session-policy";

describe("session policy", () => {
  it("expira a sessão ao fim do tecto absoluto", () => {
    const loginAt = 1_000;
    expect(absoluteSessionExpired(loginAt, loginAt + SESSION_ABSOLUTE_SECONDS - 1)).toBe(false);
    expect(absoluteSessionExpired(loginAt, loginAt + SESSION_ABSOLUTE_SECONDS)).toBe(true);
  });

  it("não trata o login como página autenticada", () => {
    expect(isPublicAuthPath("/login")).toBe(true);
    expect(isPublicAuthPath("/contas")).toBe(false);
  });
});
