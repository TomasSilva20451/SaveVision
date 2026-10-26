"use server";

import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { isMlCapability } from "@/lib/ml/registry";
import { canBackoffice, type PlatformRole } from "@/lib/platform/backoffice-policy";
import { appendAuditEvent } from "@/server/audit/audit-ledger";
import { setMlFeatureControl } from "@/server/services/ml-governance";

export async function updateMlFeatureControlAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");
  const role = await db.user.findUnique({ where: { id: user.id }, select: { systemRole: true } });
  if (!role || !canBackoffice(role.systemRole as PlatformRole, "retry-jobs")) redirect("/backoffice");

  const capability = String(formData.get("capability") ?? "");
  if (!isMlCapability(capability)) redirect("/backoffice");
  const action = String(formData.get("action") ?? "enable");
  const killSwitch = action === "kill";
  const enabled = action !== "disable" && !killSwitch;
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 240) || null;

  await setMlFeatureControl({ capability, enabled, killSwitch, reason, updatedById: user.id });
  await appendAuditEvent({
    actorUserId: user.id,
    action: "ML_FEATURE_CONTROL_CHANGED",
    resourceType: "MlFeatureControl",
    resourceId: capability,
    outcome: "SUCCESS",
    source: "ml-governance",
    metadata: { enabled, killSwitch, reason },
  });
  redirect("/backoffice");
}
