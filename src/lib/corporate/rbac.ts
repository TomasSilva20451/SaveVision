import type { WorkspaceRole } from "@/lib/permissions/workspace-policy";

export type CorporateCapability =
  | "open-banking-consent"
  | "import-bank-feed"
  | "reconcile"
  | "approve-payments"
  | "export-accounting"
  | "manage-webhooks"
  | "search-audit"
  | "manage-support-cases";

const matrix: Record<CorporateCapability, readonly WorkspaceRole[]> = {
  "open-banking-consent": ["OWNER", "MEMBER"],
  "import-bank-feed": ["OWNER", "MEMBER"],
  reconcile: ["OWNER", "MEMBER"],
  "approve-payments": ["OWNER"],
  "export-accounting": ["OWNER", "MEMBER"],
  "manage-webhooks": ["OWNER"],
  "search-audit": ["OWNER"],
  "manage-support-cases": ["OWNER", "MEMBER", "VIEWER"],
};

export function hasCorporateCapability(role: WorkspaceRole, capability: CorporateCapability): boolean {
  return matrix[capability].includes(role);
}
