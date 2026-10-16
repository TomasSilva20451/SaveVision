import { db } from "@/lib/db";
import {
  canAccessWorkspace,
  type WorkspaceMembership,
} from "@/lib/permissions/workspace-policy";

export async function listMemberships(
  userId: string,
): Promise<WorkspaceMembership[]> {
  const rows = await db.workspaceMember.findMany({
    where: { userId },
    select: { workspaceId: true, role: true, status: true },
  });

  return rows;
}

export async function listActiveWorkspaces(userId: string) {
  return db.workspace.findMany({
    where: {
      members: {
        some: { userId, status: "ACTIVE" },
      },
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: { id: true, name: true, type: true },
  });
}

export async function assertWorkspaceAccess(userId: string, workspaceId: string) {
  const memberships = await listMemberships(userId);

  if (!canAccessWorkspace(memberships, workspaceId)) {
    return null;
  }

  return db.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true, type: true },
  });
}
