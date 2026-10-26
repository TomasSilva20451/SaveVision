import "server-only";

import crypto from "node:crypto";
import { db } from "@/lib/db";
import { ERASURE_POLICY_VERSION } from "@/lib/privacy/consent-catalog";
import { buildSubjectAccessExport } from "@/server/services/privacy-export";
import { revokeAllAuthSessions } from "@/server/services/auth-protection";

function anonymizedEmail(userId: string) {
  return `deleted-${userId.slice(0, 12)}@anonymized.fintwin`;
}

export async function executeVerifiableErasure(userId: string) {
  const snapshot = await buildSubjectAccessExport(userId);
  const proofSha256 = crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");

  const request = await db.subjectErasureRequest.create({
    data: {
      userId,
      status: "IN_PROGRESS",
      consentVersion: ERASURE_POLICY_VERSION,
      proofSha256,
      metadata: { workspaceCount: snapshot.memberships.length },
    },
  });

  await db.$transaction([
    db.passkeyCredential.deleteMany({ where: { userId } }),
    db.recoveryCode.deleteMany({ where: { userId } }),
    db.userTotpCredential.deleteMany({ where: { userId } }),
    db.emailChallenge.deleteMany({ where: { userId } }),
    db.userLocalAiSettings.deleteMany({ where: { userId } }),
    db.mlInvocationEvent.updateMany({
      where: { userId },
      data: { userId: null, promptExcerpt: null, promptExpiresAt: null },
    }),
    db.user.update({
      where: { id: userId },
      data: {
        email: anonymizedEmail(userId),
        name: "Utilizador eliminado",
        phone: null,
        birthDate: null,
        avatarUrl: null,
        passwordHash: crypto.randomBytes(32).toString("hex"),
        disabledAt: new Date(),
        emailVerifiedAt: null,
      },
    }),
  ]);

  await revokeAllAuthSessions(userId);

  await db.subjectErasureRequest.update({
    where: { id: request.id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  return { requestId: request.id, proofSha256, completedAt: new Date().toISOString() };
}
