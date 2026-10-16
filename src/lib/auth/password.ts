import argon2 from "argon2";

/** OWASP: Argon2id, 19 MiB, 2 iterações, paralelismo 1. */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Hash de uma palavra-passe descartada. Serve para verificar algo
 * mesmo quando o email não existe, para o tempo de resposta não
 * distinguir as duas falhas.
 */
export const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$yYA/DJLk9mN27ozoAfAztg$KeRFCuZqW975w8UI8KqFBrlaBL1sX8vs7BU5PZDbXf4";

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}
