import { createHash, randomBytes } from "node:crypto";
import { requireWorkspaceAccess, requireWorkspaceEditor, requireWorkspaceManager } from "@/lib/auth/workspace-access";
import { hasCorporateCapability } from "@/lib/corporate/rbac";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { appendAuditEvent } from "@/server/audit/audit-ledger";
import { encryptWebhookSecret } from "@/server/security/webhook-secret";

export async function requestFinancialApproval(
  userId: string,
  workspaceId: string,
  input: {
    actionType: string;
    entityType: string;
    entityId: string;
    payload: Prisma.InputJsonValue;
  },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const approval = await db.financialApproval.create({
    data: {
      workspaceId,
      requestedById: userId,
      actionType: input.actionType,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: input.payload,
    },
  });

  await appendAuditEvent({
    actorUserId: userId,
    workspaceId,
    action: "FINANCIAL_APPROVAL_REQUESTED",
    resourceType: "FinancialApproval",
    resourceId: approval.id,
    outcome: "SUCCESS",
    source: "corporate-finance",
  });

  return approval;
}

export async function reviewFinancialApproval(
  userId: string,
  workspaceId: string,
  input: { approvalId: string; decision: "APPROVED" | "REJECTED"; note?: string },
) {
  const membership = await requireWorkspaceManager(userId, workspaceId);
  if (!membership || !hasCorporateCapability(membership.role, "approve-payments")) return null;

  const approval = await db.financialApproval.findFirst({
    where: { id: input.approvalId, workspaceId, status: "PENDING" },
  });
  if (!approval || approval.requestedById === userId) return { ok: false as const, reason: "MAKER_CHECKER" };

  await db.financialApproval.update({
    where: { id: approval.id },
    data: {
      status: input.decision,
      reviewedById: userId,
      reviewedAt: new Date(),
      reviewNote: input.note ?? null,
    },
  });

  await appendAuditEvent({
    actorUserId: userId,
    workspaceId,
    action: input.decision === "APPROVED" ? "FINANCIAL_APPROVAL_GRANTED" : "FINANCIAL_APPROVAL_DENIED",
    resourceType: "FinancialApproval",
    resourceId: approval.id,
    outcome: "SUCCESS",
    source: "corporate-finance",
  });

  return { ok: true as const };
}

export async function listPendingApprovals(userId: string, workspaceId: string) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  return db.financialApproval.findMany({
    where: { workspaceId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export async function createWebhookSubscription(
  userId: string,
  workspaceId: string,
  input: { url: string; events: string[] },
) {
  const membership = await requireWorkspaceManager(userId, workspaceId);
  if (!membership || !hasCorporateCapability(membership.role, "manage-webhooks")) return null;

  const secret = randomBytes(24).toString("hex");
  const sub = await db.webhookSubscription.create({
    data: {
      workspaceId,
      url: input.url,
      secretHash: hashSecret(secret),
      secretEnc: encryptWebhookSecret(secret),
      events: input.events.length > 0 ? input.events : ["reconciliation.matched", "bank_feed.imported"],
    },
  });

  await appendAuditEvent({
    actorUserId: userId,
    workspaceId,
    action: "WEBHOOK_SUBSCRIPTION_CREATED",
    resourceType: "WebhookSubscription",
    resourceId: sub.id,
    outcome: "SUCCESS",
    source: "corporate-finance",
  });

  return { subscription: sub, secretOnce: secret };
}

export async function listWebhookSubscriptions(userId: string, workspaceId: string) {
  const membership = await requireWorkspaceManager(userId, workspaceId);
  if (!membership) return null;

  return db.webhookSubscription.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: { id: true, url: true, events: true, active: true, createdAt: true },
  });
}

export async function openSupportCase(
  userId: string,
  workspaceId: string,
  input: { subject: string; disputeRef?: string },
) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership || !hasCorporateCapability(membership.role, "manage-support-cases")) return null;

  const supportCase = await db.supportCase.create({
    data: {
      workspaceId,
      userId,
      subject: input.subject,
      disputeRef: input.disputeRef ?? null,
    },
  });

  await appendAuditEvent({
    actorUserId: userId,
    workspaceId,
    action: "SUPPORT_CASE_OPENED",
    resourceType: "SupportCase",
    resourceId: supportCase.id,
    outcome: "SUCCESS",
    source: "corporate-finance",
  });

  return supportCase;
}

export async function listSupportCases(userId: string, workspaceId: string) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  return db.supportCase.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
}
