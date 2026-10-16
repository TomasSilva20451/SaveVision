export type WorkspaceScoped = {
  readonly workspaceId: string;
};

export function canAccessWorkspace(
  membershipWorkspaceIds: readonly string[],
  workspaceId: string,
): boolean {
  return membershipWorkspaceIds.includes(workspaceId);
}

export function canAccessRecord(
  membershipWorkspaceIds: readonly string[],
  record: WorkspaceScoped,
): boolean {
  return canAccessWorkspace(membershipWorkspaceIds, record.workspaceId);
}
