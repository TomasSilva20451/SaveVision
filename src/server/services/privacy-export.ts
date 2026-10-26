import "server-only";

import { db } from "@/lib/db";
import { CONSENT_CATALOG } from "@/lib/privacy/consent-catalog";
import { RETENTION_DAYS } from "@/lib/privacy/retention-policy";

export async function buildSubjectAccessExport(userId: string) {
  const memberships = await db.workspaceMember.findMany({
    where: { userId, status: "ACTIVE" },
    select: {
      role: true,
      workspace: { select: { id: true, name: true, type: true, createdAt: true } },
    },
  });
  const workspaceIds = memberships.map((m) => m.workspace.id);

  const [user, consents, localAi, sessions, securityEvents, erasures, mlInvocations] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        birthDate: true,
        avatarUrl: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        disabledAt: true,
      },
    }),
    db.privacyConsent.findMany({ where: { userId }, orderBy: { acceptedAt: "desc" } }),
    db.userLocalAiSettings.findUnique({ where: { userId } }),
    db.authSession.findMany({
      where: { userId },
      select: { id: true, deviceLabel: true, createdAt: true, lastSeenAt: true, revokedAt: true },
    }),
    db.securityEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { type: true, createdAt: true, metadata: true },
    }),
    db.subjectErasureRequest.findMany({ where: { userId }, orderBy: { requestedAt: "desc" }, take: 5 }),
    db.mlInvocationEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        capability: true,
        modelKey: true,
        modelVersion: true,
        promptKey: true,
        promptVersion: true,
        outcome: true,
        latencyMs: true,
        confidence: true,
        fallbackReason: true,
        humanReviewRequired: true,
        createdAt: true,
        promptExcerpt: true,
        promptExpiresAt: true,
      },
    }),
  ]);

  const workspaceSummaries = await Promise.all(
    workspaceIds.map(async (workspaceId) => {
      const [accounts, transactions, documents] = await Promise.all([
        db.financialAccount.count({ where: { workspaceId } }),
        db.transaction.count({ where: { workspaceId, deletedAt: null } }),
        db.storedDocument.count({ where: { workspaceId } }),
      ]);
      return { workspaceId, accounts, transactions, documents };
    }),
  );

  const transactionsSample =
    workspaceIds.length === 0
      ? []
      : await db.transaction.findMany({
          where: { workspaceId: { in: workspaceIds }, deletedAt: null },
          orderBy: { occurredAt: "desc" },
          take: 500,
          select: {
            id: true,
            workspaceId: true,
            type: true,
            amount: true,
            currency: true,
            occurredAt: true,
            description: true,
            status: true,
          },
        });

  return {
    exportedAt: new Date().toISOString(),
    format: "fintwin-subject-access-v1",
    governance: {
      consentCatalog: CONSENT_CATALOG.map(({ key, version, title, legalBasis, purpose }) => ({
        key,
        version,
        title,
        legalBasis,
        purpose,
      })),
      retentionDays: RETENTION_DAYS,
    },
    dataSubject: user,
    memberships,
    workspaces: workspaceSummaries,
    transactionsSample,
    localAiSettings: localAi,
    sessions,
    securityEvents,
    privacyConsents: consents,
    erasureRequests: erasures,
    mlInvocations,
  };
}
