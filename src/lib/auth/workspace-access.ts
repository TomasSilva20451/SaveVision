import {
  canEditTransaction,
  canManageWorkspace,
  canViewTransaction,
  membershipFor,
  type WorkspaceRole,
} from "@/lib/permissions/workspace-policy";
import { listMemberships } from "@/server/repositories/workspaces";

export async function requireWorkspaceAccess(
  userId: string,
  workspaceId: string,
) {
  const memberships = await listMemberships(userId);

  if (!canViewTransaction(memberships, workspaceId)) {
    return null;
  }

  return membershipFor(memberships, workspaceId)!;
}

export async function requireWorkspaceRole(
  userId: string,
  workspaceId: string,
  roles: readonly WorkspaceRole[],
) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);

  if (!membership || !roles.includes(membership.role)) {
    return null;
  }

  return membership;
}

export async function requireWorkspaceEditor(userId: string, workspaceId: string) {
  const memberships = await listMemberships(userId);

  if (!canEditTransaction(memberships, workspaceId)) {
    return null;
  }

  return membershipFor(memberships, workspaceId)!;
}

export async function requireWorkspaceManager(
  userId: string,
  workspaceId: string,
) {
  const memberships = await listMemberships(userId);

  if (!canManageWorkspace(memberships, workspaceId)) {
    return null;
  }

  return membershipFor(memberships, workspaceId)!;
}
