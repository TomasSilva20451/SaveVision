import { hashPassword } from "@/lib/auth/password";
import type { CreatePlatformUserInput } from "@/lib/platform/platform-user-schema";
import { db } from "@/lib/db";
import { appendAuditEvent } from "@/server/audit/audit-ledger";

export type PlatformUserSummary = {
  id: string;
  email: string;
  name: string;
  systemRole: string;
  createdAt: Date;
  disabledAt: Date | null;
};

export async function listPlatformUsers(): Promise<PlatformUserSummary[]> {
  return db.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      systemRole: true,
      createdAt: true,
      disabledAt: true,
    },
    orderBy: [{ systemRole: "desc" }, { createdAt: "asc" }],
  });
}

async function ensurePersonalWorkspace(userId: string, name: string) {
  const membership = await db.workspaceMember.findFirst({
    where: { userId, status: "ACTIVE", workspace: { type: "PERSONAL" } },
    select: { workspaceId: true },
  });
  if (membership) return;

  await db.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: { name, type: "PERSONAL", createdById: userId },
    });
    await tx.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId,
        role: "OWNER",
        status: "ACTIVE",
        joinedAt: new Date(),
      },
    });
  });
}

export async function provisionPlatformUser(
  actorUserId: string,
  input: CreatePlatformUserInput,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const existing = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) {
    return { ok: false, error: "Já existe uma conta com este email." };
  }

  const passwordHash = await hashPassword(input.password);
  const verifiedAt = new Date();
  const user = await db.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      emailVerifiedAt: verifiedAt,
      systemRole: "USER",
    },
  });
  await ensurePersonalWorkspace(user.id, input.name);

  await appendAuditEvent({
    actorUserId,
    action: "PLATFORM_USER_CREATED",
    resourceType: "User",
    resourceId: user.id,
    outcome: "SUCCESS",
    source: "platform-admin",
    metadata: { email: input.email },
  });

  return { ok: true, userId: user.id };
}
