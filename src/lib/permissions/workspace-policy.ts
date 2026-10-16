export const workspaceRoles = ["OWNER", "MEMBER", "VIEWER"] as const;
export const membershipStatuses = [
  "INVITED",
  "ACTIVE",
  "DECLINED",
  "REMOVED",
] as const;

export type WorkspaceRole = (typeof workspaceRoles)[number];
export type MembershipStatus = (typeof membershipStatuses)[number];

export type WorkspaceMembership = {
  workspaceId: string;
  role: WorkspaceRole;
  status: MembershipStatus;
};

export function activeMemberships(
  memberships: readonly WorkspaceMembership[],
): WorkspaceMembership[] {
  return memberships.filter((membership) => membership.status === "ACTIVE");
}

export function membershipFor(
  memberships: readonly WorkspaceMembership[],
  workspaceId: string,
): WorkspaceMembership | undefined {
  return activeMemberships(memberships).find(
    (membership) => membership.workspaceId === workspaceId,
  );
}

export function canAccessWorkspace(
  memberships: readonly WorkspaceMembership[],
  workspaceId: string,
): boolean {
  return membershipFor(memberships, workspaceId) !== undefined;
}

export function canManageWorkspace(
  memberships: readonly WorkspaceMembership[],
  workspaceId: string,
): boolean {
  return membershipFor(memberships, workspaceId)?.role === "OWNER";
}

export function canEditTransaction(
  memberships: readonly WorkspaceMembership[],
  workspaceId: string,
): boolean {
  const role = membershipFor(memberships, workspaceId)?.role;
  return role === "OWNER" || role === "MEMBER";
}

export function canViewTransaction(
  memberships: readonly WorkspaceMembership[],
  workspaceId: string,
): boolean {
  return canAccessWorkspace(memberships, workspaceId);
}
