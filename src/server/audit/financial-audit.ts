import type { FinancialAuditAction } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export async function writeFinancialAuditLog(input: {
  workspaceId: string;
  actorUserId: string;
  action: FinancialAuditAction;
  entityType: string;
  entityId: string;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  await db.financialAuditLog.create({
    data: {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ?? undefined,
    },
  });
}
