import "server-only";

import { db } from "@/lib/db";
import { hashDevice, hashIp } from "@/server/services/auth-protection";
import { randomToken, sha256 } from "@/lib/auth/security-crypto";

export const LOGIN_MFA_CHALLENGE_MS = 5 * 60 * 1000;
export const LOGIN_MFA_CHALLENGE_MAX_ATTEMPTS = 5;

export type LoginMfaGate = "mfa-totp" | "mfa-passkey" | "mfa-either";

function hashLoginMfaToken(token: string): string {
  return sha256(`login_mfa:${token}`);
}

export async function issueLoginMfaChallenge(input: {
  userId: string;
  mfaGate: LoginMfaGate;
  ip: string;
  deviceId?: string;
}): Promise<string> {
  const token = randomToken();
  const tokenHash = hashLoginMfaToken(token);
  const expiresAt = new Date(Date.now() + LOGIN_MFA_CHALLENGE_MS);

  await db.$transaction([
    db.loginMfaChallenge.updateMany({
      where: { userId: input.userId, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    }),
    db.loginMfaChallenge.create({
      data: {
        userId: input.userId,
        tokenHash,
        mfaGate: input.mfaGate,
        expiresAt,
        ipHash: hashIp(input.ip),
        deviceHash: input.deviceId ? hashDevice(input.deviceId) : null,
      },
    }),
  ]);

  return token;
}

export type ResolvedLoginMfaChallenge = {
  id: string;
  userId: string;
  mfaGate: LoginMfaGate;
  attempts: number;
  expiresAt: Date;
};

export async function resolveLoginMfaChallenge(token: string): Promise<ResolvedLoginMfaChallenge | null> {
  const trimmed = token.trim();
  if (trimmed.length < 16) return null;
  const row = await db.loginMfaChallenge.findUnique({
    where: { tokenHash: hashLoginMfaToken(trimmed) },
    select: { id: true, userId: true, mfaGate: true, attempts: true, expiresAt: true, consumedAt: true },
  });
  if (!row || row.consumedAt) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  if (row.attempts >= LOGIN_MFA_CHALLENGE_MAX_ATTEMPTS) return null;
  return {
    id: row.id,
    userId: row.userId,
    mfaGate: row.mfaGate as LoginMfaGate,
    attempts: row.attempts,
    expiresAt: row.expiresAt,
  };
}

export async function assertLoginMfaChallengeForEmail(token: string, email: string): Promise<ResolvedLoginMfaChallenge | null> {
  const challenge = await resolveLoginMfaChallenge(token);
  if (!challenge) return null;
  const normalized = email.trim().toLowerCase();
  const user = await db.user.findUnique({
    where: { id: challenge.userId },
    select: { email: true },
  });
  if (!user || user.email !== normalized) return null;
  return challenge;
}

export async function recordLoginMfaChallengeFailure(challengeId: string) {
  const row = await db.loginMfaChallenge.update({
    where: { id: challengeId },
    data: { attempts: { increment: 1 } },
    select: { attempts: true },
  });
  if (row.attempts >= LOGIN_MFA_CHALLENGE_MAX_ATTEMPTS) {
    await db.loginMfaChallenge.update({
      where: { id: challengeId },
      data: { consumedAt: new Date() },
    });
  }
}

export async function consumeLoginMfaChallenge(challengeId: string) {
  await db.loginMfaChallenge.updateMany({
    where: { id: challengeId, consumedAt: null },
    data: { consumedAt: new Date() },
  });
}

export async function revokeLoginMfaChallenge(token: string) {
  const trimmed = token.trim();
  if (trimmed.length < 16) return;
  await db.loginMfaChallenge.updateMany({
    where: { tokenHash: hashLoginMfaToken(trimmed), consumedAt: null },
    data: { consumedAt: new Date() },
  });
}
