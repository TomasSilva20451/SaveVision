import { randomBytes } from "node:crypto";
import { requireWorkspaceAccess, requireWorkspaceManager } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db";

function inviteToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createJointWorkspace(
  userId: string,
  name: string,
) {
  return db.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name,
        type: "JOINT",
        createdById: userId,
      },
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

    return workspace;
  });
}

export async function inviteToJointWorkspace(
  userId: string,
  workspaceId: string,
  email: string,
  role: "MEMBER" | "VIEWER" = "MEMBER",
) {
  const membership = await requireWorkspaceManager(userId, workspaceId);
  if (!membership) return null;

  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace || workspace.type !== "JOINT") return null;

  const normalized = email.trim().toLowerCase();
  const invitee = await db.user.findUnique({ where: { email: normalized } });

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const token = inviteToken();

  await db.workspaceInvite.create({
    data: {
      workspaceId,
      email: normalized,
      role,
      token,
      invitedById: userId,
      expiresAt,
    },
  });

  if (invitee) {
    await db.workspaceMember.upsert({
      where: {
        workspaceId_userId: { workspaceId, userId: invitee.id },
      },
      create: {
        workspaceId,
        userId: invitee.id,
        role,
        status: "INVITED",
      },
      update: {
        role,
        status: "INVITED",
      },
    });
  }

  return { token, email: normalized, invitePath: `/conta-conjunta?convite=${token}` };
}

export async function declineWorkspaceInvite(userId: string, token: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const invite = await db.workspaceInvite.findUnique({ where: { token } });
  if (!invite || invite.acceptedAt) return null;
  if (invite.expiresAt < new Date()) return null;
  if (invite.email !== user.email.toLowerCase()) return null;

  await db.$transaction(async (tx) => {
    await tx.workspaceMember.updateMany({
      where: {
        workspaceId: invite.workspaceId,
        userId,
        status: "INVITED",
      },
      data: { status: "DECLINED" },
    });
    await tx.workspaceInvite.update({
      where: { id: invite.id },
      data: { expiresAt: new Date() },
    });
  });

  return true;
}

export async function revokeWorkspaceInvite(
  userId: string,
  workspaceId: string,
  inviteId: string,
) {
  const membership = await requireWorkspaceManager(userId, workspaceId);
  if (!membership) return null;

  const invite = await db.workspaceInvite.findFirst({
    where: { id: inviteId, workspaceId, acceptedAt: null },
  });
  if (!invite) return null;

  await db.$transaction(async (tx) => {
    await tx.workspaceInvite.update({
      where: { id: invite.id },
      data: { expiresAt: new Date() },
    });
    await tx.workspaceMember.updateMany({
      where: {
        workspaceId,
        user: { email: invite.email },
        status: "INVITED",
      },
      data: { status: "REMOVED" },
    });
  });

  return true;
}

export async function listWorkspaceInvitesForManager(
  userId: string,
  workspaceId: string,
) {
  const membership = await requireWorkspaceManager(userId, workspaceId);
  if (!membership) return null;

  return db.workspaceInvite.findMany({
    where: {
      workspaceId,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      token: true,
      expiresAt: true,
      createdAt: true,
    },
  });
}

export async function acceptWorkspaceInvite(userId: string, token: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const invite = await db.workspaceInvite.findUnique({ where: { token } });
  if (!invite || invite.acceptedAt) return null;
  if (invite.expiresAt < new Date()) return null;
  if (invite.email !== user.email.toLowerCase()) return null;

  await db.$transaction(async (tx) => {
    await tx.workspaceMember.upsert({
      where: {
        workspaceId_userId: { workspaceId: invite.workspaceId, userId },
      },
      create: {
        workspaceId: invite.workspaceId,
        userId,
        role: invite.role,
        status: "ACTIVE",
        joinedAt: new Date(),
      },
      update: {
        role: invite.role,
        status: "ACTIVE",
        joinedAt: new Date(),
      },
    });

    await tx.workspaceInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
  });

  return invite.workspaceId;
}

export async function listPendingInvitesForUser(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return [];

  return db.workspaceInvite.findMany({
    where: {
      email: user.email.toLowerCase(),
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { workspace: { select: { id: true, name: true } } },
  });
}

export async function getJointWorkspaceSummary(
  userId: string,
  workspaceId: string,
) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: {
        where: { status: "ACTIVE" },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      savingsGoals: {
        where: { archived: false },
        include: { contributions: true },
      },
    },
  });

  if (!workspace || workspace.type !== "JOINT") return null;

  return workspace;
}

export async function assertPersonalWorkspaceIsolation(
  userId: string,
  targetWorkspaceId: string,
): Promise<boolean> {
  const workspace = await db.workspace.findUnique({
    where: { id: targetWorkspaceId },
  });
  if (!workspace || workspace.type !== "PERSONAL") {
    return false;
  }

  const membership = await requireWorkspaceAccess(userId, targetWorkspaceId);
  return membership === null;
}
