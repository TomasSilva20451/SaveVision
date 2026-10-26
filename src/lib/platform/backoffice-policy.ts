export type PlatformRole = "USER" | "SUPPORT" | "ADMIN";

export type BackofficeCapability =
  | "open"
  | "list-jobs"
  | "retry-jobs"
  | "read-financial-records"
  | "read-document-bytes";

const matrix: Record<BackofficeCapability, readonly PlatformRole[]> = {
  open: ["SUPPORT", "ADMIN"],
  "list-jobs": ["SUPPORT", "ADMIN"],
  "retry-jobs": ["ADMIN"],
  "read-financial-records": [],
  "read-document-bytes": [],
};

export function canBackoffice(role: PlatformRole, capability: BackofficeCapability): boolean {
  return matrix[capability].includes(role);
}
