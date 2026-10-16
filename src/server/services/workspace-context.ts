import { cookies } from "next/headers";
import {
  WORKSPACE_COOKIE,
  workspaceCookieOptions,
} from "@/lib/auth/workspace-cookie";
import { canAccessWorkspace } from "@/lib/permissions/workspace-policy";
import {
  assertWorkspaceAccess,
  listActiveWorkspaces,
  listMemberships,
} from "@/server/repositories/workspaces";

export async function resolveWorkspaceContext(userId: string) {
  const workspaces = await listActiveWorkspaces(userId);
  const cookieStore = await cookies();
  const requested = cookieStore.get(WORKSPACE_COOKIE)?.value;
  const selectedId =
    workspaces.find((workspace) => workspace.id === requested)?.id ??
    workspaces[0]?.id ??
    null;

  const selected =
    selectedId != null
      ? (workspaces.find((workspace) => workspace.id === selectedId) ?? null)
      : null;

  return { workspaces, selected };
}

export async function setActiveWorkspace(userId: string, workspaceId: string) {
  const memberships = await listMemberships(userId);

  if (!canAccessWorkspace(memberships, workspaceId)) {
    return false;
  }

  const workspace = await assertWorkspaceAccess(userId, workspaceId);

  if (!workspace) {
    return false;
  }

  const cookieStore = await cookies();
  cookieStore.set(
    WORKSPACE_COOKIE,
    workspaceId,
    workspaceCookieOptions(process.env.NODE_ENV),
  );

  return true;
}
