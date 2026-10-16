import { describe, expect, it } from "vitest";
import {
  authenticateCredentials,
  INVALID_CREDENTIALS_MESSAGE,
  LOGIN_MAX_FAILURES,
  TOO_MANY_ATTEMPTS_MESSAGE,
  type LoginUser,
} from "@/lib/auth/login-policy";

const user: LoginUser = {
  id: "user-1",
  email: "user1@example.local",
  name: "João",
  passwordHash: "hash-real",
};

function deps(
  overrides: Partial<Parameters<typeof authenticateCredentials>[1]> = {},
) {
  const findUser = overrides.findUser ?? (async () => user);
  const verify =
    overrides.verify ??
    (async (hash: string, password: string) =>
      hash === "hash-real" && password === "correta");

  return {
    now: 1_000,
    attempt: undefined,
    dummyHash: "hash-dummy",
    findUser,
    verify,
    ...overrides,
  };
}

describe("authenticateCredentials", () => {
  it("usa a mesma mensagem quando o email não existe ou a palavra-passe falha", async () => {
    const missing = await authenticateCredentials(
      { email: "ausente@example.local", password: "qualquer" },
      deps({
        findUser: async () => null,
        verify: async (hash) => hash === "hash-real",
      }),
    );
    const wrongPassword = await authenticateCredentials(
      { email: "user1@example.local", password: "errada" },
      deps(),
    );

    expect(missing.result).toEqual({
      ok: false,
      message: INVALID_CREDENTIALS_MESSAGE,
    });
    expect(wrongPassword.result).toEqual(missing.result);
  });

  it("bloqueia depois do número máximo de falhas", async () => {
    let attempt = undefined;
    let lastMessage = "";

    for (let index = 0; index < LOGIN_MAX_FAILURES; index += 1) {
      const decision = await authenticateCredentials(
        { email: "user1@example.local", password: "errada" },
        deps({ now: 1_000 + index, attempt }),
      );
      attempt = decision.attempt;
      if (!decision.result.ok) {
        lastMessage = decision.result.message;
      }
    }

    expect(lastMessage).toBe(TOO_MANY_ATTEMPTS_MESSAGE);

    let lookedUp = false;
    const blocked = await authenticateCredentials(
      { email: "user1@example.local", password: "correta" },
      deps({
        now: 1_500,
        attempt,
        findUser: async () => {
          lookedUp = true;
          return user;
        },
      }),
    );

    expect(lookedUp).toBe(false);
    expect(blocked.result).toEqual({
      ok: false,
      message: TOO_MANY_ATTEMPTS_MESSAGE,
    });
  });

  it("aceita a palavra-passe correta e limpa as tentativas", async () => {
    const decision = await authenticateCredentials(
      { email: " User1@example.local ", password: "correta" },
      deps({
        attempt: { failures: 2, windowStartedAt: 1_000, blockedUntil: null },
      }),
    );

    expect(decision.attempt).toBeUndefined();
    expect(decision.result).toEqual({
      ok: true,
      user: { id: "user-1", email: "user1@example.local", name: "João" },
    });
  });
});
