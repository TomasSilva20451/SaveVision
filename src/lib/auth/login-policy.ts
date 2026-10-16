export const INVALID_CREDENTIALS_MESSAGE = "Credenciais inválidas.";
export const TOO_MANY_ATTEMPTS_MESSAGE =
  "Demasiadas tentativas. Tenta novamente dentro de alguns minutos.";

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_BLOCK_MS = 15 * 60 * 1000;

export type AttemptState = {
  failures: number;
  windowStartedAt: number;
  blockedUntil: number | null;
};

export function isLoginBlocked(
  current: AttemptState | undefined,
  now: number,
): boolean {
  return current?.blockedUntil != null && current.blockedUntil > now;
}

export function recordLoginFailure(
  current: AttemptState | undefined,
  now: number,
): AttemptState {
  const inWindow =
    current != null && now - current.windowStartedAt < LOGIN_WINDOW_MS;
  const failures = inWindow ? current.failures + 1 : 1;
  const blocked = failures >= LOGIN_MAX_FAILURES;

  return {
    failures,
    windowStartedAt: inWindow ? current.windowStartedAt : now,
    blockedUntil: blocked ? now + LOGIN_BLOCK_MS : null,
  };
}

export function loginErrorMessage(blocked: boolean): string {
  return blocked ? TOO_MANY_ATTEMPTS_MESSAGE : INVALID_CREDENTIALS_MESSAGE;
}

export type LoginUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
};

export type LoginSuccess = {
  ok: true;
  user: Pick<LoginUser, "id" | "email" | "name">;
};

export type LoginFailure = {
  ok: false;
  message: string;
};

export async function authenticateCredentials(
  input: { email: string; password: string },
  deps: {
    now: number;
    attempt: AttemptState | undefined;
    findUser: (email: string) => Promise<LoginUser | null>;
    verify: (passwordHash: string, password: string) => Promise<boolean>;
    dummyHash: string;
  },
): Promise<{ result: LoginSuccess | LoginFailure; attempt: AttemptState | undefined }> {
  const email = input.email.trim().toLowerCase();

  if (isLoginBlocked(deps.attempt, deps.now)) {
    return {
      result: { ok: false, message: TOO_MANY_ATTEMPTS_MESSAGE },
      attempt: deps.attempt,
    };
  }

  const user = await deps.findUser(email);
  const passwordOk = await deps.verify(
    user?.passwordHash ?? deps.dummyHash,
    input.password,
  );

  if (!user || !passwordOk) {
    const attempt = recordLoginFailure(deps.attempt, deps.now);
    return {
      result: { ok: false, message: loginErrorMessage(attempt.blockedUntil != null) },
      attempt,
    };
  }

  return {
    result: {
      ok: true,
      user: { id: user.id, email: user.email, name: user.name },
    },
    attempt: undefined,
  };
}
