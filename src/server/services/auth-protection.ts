import "server-only";

import { db } from "@/lib/db";
import {
  ACCOUNT_BLOCK_MS,
  ACCOUNT_MAX_FAILURES,
  DEVICE_BLOCK_MS,
  DEVICE_MAX_FAILURES,
  IP_BLOCK_MS,
  IP_MAX_FAILURES,
  STUFFING_DISTINCT_ACCOUNTS,
  isBucketBlocked,
  recordScopedFailure,
  type RateBucket,
} from "@/lib/auth/distributed-rate-limit";
import { decryptSecret, encryptSecret, randomToken, sha256 } from "@/lib/auth/security-crypto";
import { generateRecoveryCodes, hashRecoveryCode, recoveryCodeMatches } from "@/lib/auth/recovery-codes";
import { generateTotpSecret, totpAuthUri, verifyTotpCode } from "@/lib/auth/totp";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/auth/password";
import { appendAuditEvent } from "@/server/audit/audit-ledger";
import {
  deleteAuthRateBuckets,
  readAuthRateBucket,
  writeAuthRateBucket,
} from "@/server/security/auth-rate-bucket-store";

const CHALLENGE_MS = 15 * 60 * 1000;

export function hashIp(ip: string): string {
  return sha256(`ip:${ip}`);
}

export function hashDevice(deviceId: string): string {
  return sha256(`device:${deviceId}`);
}

export function deviceLabelFromUserAgent(userAgent: string | null): string {
  if (!userAgent) return "Dispositivo desconhecido";
  if (/iPhone|iPad/.test(userAgent)) return "Safari / iOS";
  if (/Android/.test(userAgent)) return "Android";
  if (/Edg\//.test(userAgent)) return "Microsoft Edge";
  if (/Chrome\//.test(userAgent)) return "Google Chrome";
  if (/Firefox\//.test(userAgent)) return "Firefox";
  if (/Safari\//.test(userAgent)) return "Safari";
  return "Navegador";
}

async function readBucket(key: string): Promise<RateBucket | undefined> {
  return readAuthRateBucket(key);
}

async function writeBucket(key: string, bucket: RateBucket) {
  await writeAuthRateBucket(key, bucket);
}

export async function loginBlockReason(input: { email: string; ip: string; deviceId?: string }): Promise<string | null> {
  const now = Date.now();
  const email = input.email.trim().toLowerCase();
  const buckets = await Promise.all([
    readBucket(`account:${sha256(email)}`),
    readBucket(`ip:${hashIp(input.ip)}`),
    input.deviceId ? readBucket(`device:${hashDevice(input.deviceId)}`) : Promise.resolve(undefined),
  ]);
  if (buckets.some((bucket) => isBucketBlocked(bucket, now))) {
    return "Demasiadas tentativas neste IP, conta ou dispositivo. Tenta novamente mais tarde.";
  }
  return null;
}

export async function registerLoginFailure(input: { email: string; ip: string; deviceId?: string }) {
  const now = Date.now();
  const email = input.email.trim().toLowerCase();
  const emailHash = sha256(email);
  const scopes: Array<{ key: string; scope: "account" | "ip" | "device"; maxFailures: number; blockMs: number; subject?: string; stuffingAt?: number }> = [
    { key: `account:${emailHash}`, scope: "account", maxFailures: ACCOUNT_MAX_FAILURES, blockMs: ACCOUNT_BLOCK_MS },
    { key: `ip:${hashIp(input.ip)}`, scope: "ip", maxFailures: IP_MAX_FAILURES, blockMs: IP_BLOCK_MS, subject: emailHash, stuffingAt: STUFFING_DISTINCT_ACCOUNTS },
  ];
  if (input.deviceId) {
    scopes.push({ key: `device:${hashDevice(input.deviceId)}`, scope: "device", maxFailures: DEVICE_MAX_FAILURES, blockMs: DEVICE_BLOCK_MS });
  }

  let reason: string | null = null;
  for (const scope of scopes) {
    const current = await readBucket(scope.key);
    const decision = recordScopedFailure(current, now, scope);
    await writeBucket(scope.key, decision.bucket);
    if (decision.blocked && decision.reason) reason = decision.reason;
  }

  await recordSecurityEvent({
    email,
    type: reason === "stuffing" ? "CREDENTIAL_STUFFING_BLOCK" : "LOGIN_FAILURE",
    ip: input.ip,
    deviceId: input.deviceId,
    metadata: reason ? { reason } : undefined,
  });
}

export async function clearLoginFailures(input: { email: string; ip: string; deviceId?: string }) {
  const email = input.email.trim().toLowerCase();
  const keys = [`account:${sha256(email)}`, `ip:${hashIp(input.ip)}`];
  if (input.deviceId) keys.push(`device:${hashDevice(input.deviceId)}`);
  await deleteAuthRateBuckets(keys);
}

export async function openAuthSession(input: {
  userId: string;
  userAgent: string | null;
  ip: string;
  deviceId?: string;
}) {
  return db.authSession.create({
    data: {
      userId: input.userId,
      deviceLabel: deviceLabelFromUserAgent(input.userAgent),
      userAgent: input.userAgent?.slice(0, 300) ?? null,
      ipHash: hashIp(input.ip),
      deviceHash: input.deviceId ? hashDevice(input.deviceId) : null,
    },
    select: { id: true },
  });
}

export async function assertSessionActive(userId: string, sessionId: string | undefined): Promise<boolean> {
  if (!sessionId) return true;
  const row = await db.authSession.findFirst({
    where: { id: sessionId, userId, revokedAt: null },
    select: { id: true },
  });
  return Boolean(row);
}

export async function recordSecurityEvent(input: {
  userId?: string;
  email?: string;
  type: string;
  ip?: string;
  deviceId?: string;
  metadata?: Record<string, string>;
}) {
  const event = await db.securityEvent.create({
    data: {
      userId: input.userId,
      email: input.email,
      type: input.type,
      ipHash: input.ip ? hashIp(input.ip) : null,
      deviceHash: input.deviceId ? hashDevice(input.deviceId) : null,
      metadata: input.metadata,
    },
  });
  await appendAuditEvent({
    actorUserId: input.userId,
    actorReference: input.userId ?? (input.email ? `email:${sha256(input.email.trim().toLowerCase())}` : "anonymous"),
    action: input.type,
    resourceType: "SecurityEvent",
    resourceId: event.id,
    outcome: input.type.includes("FAILURE") || input.type.includes("BLOCK") ? "DENIED" : "SUCCESS",
    source: "authentication",
    ip: input.ip,
    metadata: input.metadata,
  });
}

export async function peekLoginState(
  email: string,
  password: string,
): Promise<"invalid" | "ok" | "mfa-totp" | "mfa-passkey" | "mfa-either" | "unverified" | "disabled"> {
  const normalized = email.trim().toLowerCase();
  const user = await db.user.findUnique({
    where: { email: normalized },
    select: { id: true, passwordHash: true, emailVerifiedAt: true, disabledAt: true },
  });
  const passwordOk = await verifyPassword(user?.passwordHash ?? DUMMY_PASSWORD_HASH, password);
  if (!user || !passwordOk) return "invalid";
  if (user.disabledAt) return "disabled";
  if (!user.emailVerifiedAt) return "unverified";
  const [totp, passkeys] = await Promise.all([
    db.userTotpCredential.findUnique({ where: { userId: user.id }, select: { enabledAt: true } }),
    db.passkeyCredential.count({ where: { userId: user.id } }),
  ]);
  const totpOn = Boolean(totp?.enabledAt);
  if (totpOn && passkeys > 0) return "mfa-either";
  if (totpOn) return "mfa-totp";
  if (passkeys > 0) return "mfa-passkey";
  return "ok";
}

export async function userNeedsSecondFactor(userId: string): Promise<boolean> {
  const [totp, passkeys] = await Promise.all([
    db.userTotpCredential.findUnique({ where: { userId }, select: { enabledAt: true } }),
    db.passkeyCredential.count({ where: { userId } }),
  ]);
  return Boolean(totp?.enabledAt) || passkeys > 0;
}

export async function verifySecondFactor(userId: string, input: { totp?: string; recoveryCode?: string }): Promise<boolean> {
  if (input.totp) {
    const totp = await db.userTotpCredential.findUnique({ where: { userId } });
    if (totp?.enabledAt && verifyTotpCode(decryptSecret(totp.secretCiphertext), input.totp)) return true;
  }

  if (input.recoveryCode) {
    const codes = await db.recoveryCode.findMany({ where: { userId, usedAt: null } });
    const match = codes.find((code) => recoveryCodeMatches(input.recoveryCode!, code.codeHash));
    if (!match) return false;
    await db.recoveryCode.update({ where: { id: match.id }, data: { usedAt: new Date() } });
    await recordSecurityEvent({ userId, type: "RECOVERY_CODE_USED" });
    return true;
  }

  return false;
}

export async function beginTotpEnrollment(userId: string, email: string) {
  const secret = generateTotpSecret();
  await db.userTotpCredential.upsert({
    where: { userId },
    create: { userId, secretCiphertext: encryptSecret(secret) },
    update: { secretCiphertext: encryptSecret(secret), enabledAt: null },
  });
  return { secret, uri: totpAuthUri(secret, email) };
}

export async function confirmTotpEnrollment(userId: string, code: string): Promise<string[] | null> {
  const totp = await db.userTotpCredential.findUnique({ where: { userId } });
  if (!totp) return null;
  if (!verifyTotpCode(decryptSecret(totp.secretCiphertext), code)) return null;
  const codes = generateRecoveryCodes();
  await db.$transaction([
    db.userTotpCredential.update({ where: { userId }, data: { enabledAt: new Date() } }),
    db.recoveryCode.deleteMany({ where: { userId } }),
    db.recoveryCode.createMany({ data: codes.map((code) => ({ userId, codeHash: hashRecoveryCode(code) })) }),
  ]);
  await recordSecurityEvent({ userId, type: "MFA_ENABLED" });
  return codes;
}

export async function disableTotp(userId: string) {
  await db.$transaction([
    db.userTotpCredential.deleteMany({ where: { userId } }),
    db.recoveryCode.deleteMany({ where: { userId } }),
  ]);
  await recordSecurityEvent({ userId, type: "MFA_DISABLED" });
}

export async function regenerateRecoveryCodes(userId: string): Promise<string[]> {
  const codes = generateRecoveryCodes();
  await db.$transaction([
    db.recoveryCode.deleteMany({ where: { userId } }),
    db.recoveryCode.createMany({ data: codes.map((code) => ({ userId, codeHash: hashRecoveryCode(code) })) }),
  ]);
  await recordSecurityEvent({ userId, type: "RECOVERY_CODES_REGENERATED" });
  return codes;
}

export async function issueEmailChallenge(input: { userId: string; email: string; purpose: "VERIFY_EMAIL" | "RECOVER_ACCOUNT" }) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + CHALLENGE_MS);
  await db.emailChallenge.create({
    data: {
      userId: input.userId,
      email: input.email.trim().toLowerCase(),
      purpose: input.purpose,
      tokenHash: sha256(token),
      expiresAt,
    },
  });
  await recordSecurityEvent({
    userId: input.userId,
    email: input.email,
    type: input.purpose === "VERIFY_EMAIL" ? "EMAIL_VERIFICATION_SENT" : "ACCOUNT_RECOVERY_REQUESTED",
  });
  return { token, expiresAt };
}

export async function readEmailChallenge(token: string, purpose: "VERIFY_EMAIL" | "RECOVER_ACCOUNT") {
  const row = await db.emailChallenge.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.purpose !== purpose || row.consumedAt || row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

export async function consumeEmailChallenge(token: string, purpose: "VERIFY_EMAIL" | "RECOVER_ACCOUNT") {
  const row = await readEmailChallenge(token, purpose);
  if (!row) return null;
  await db.emailChallenge.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
  return row;
}

export async function revokeAuthSession(userId: string, sessionId: string) {
  await db.authSession.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await recordSecurityEvent({ userId, type: "SESSION_REVOKED" });
}

export async function revokeAllAuthSessions(userId: string) {
  await db.authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await recordSecurityEvent({ userId, type: "GLOBAL_LOGOUT" });
}

export async function passwordMatches(userId: string, password: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) return false;
  return verifyPassword(user.passwordHash, password);
}
