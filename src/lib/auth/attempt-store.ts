import type { AttemptState } from "@/lib/auth/login-policy";

const attempts = new Map<string, AttemptState>();

export function readAttempt(email: string): AttemptState | undefined {
  return attempts.get(normalizeEmail(email));
}

export function writeAttempt(email: string, attempt: AttemptState | undefined) {
  const key = normalizeEmail(email);

  if (!attempt) {
    attempts.delete(key);
    return;
  }

  attempts.set(key, attempt);
}

export function resetLoginAttempts() {
  attempts.clear();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
