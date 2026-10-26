"use server";

import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { canBackoffice, type PlatformRole } from "@/lib/platform/backoffice-policy";
import { db } from "@/lib/db";
import { retryFailedPlatformJob } from "@/server/services/platform-jobs";

export async function retryPlatformJobAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");
  const role = await db.user.findUnique({ where: { id: user.id }, select: { systemRole: true } });
  if (!role || !canBackoffice(role.systemRole as PlatformRole, "retry-jobs")) {
    redirect("/backoffice");
  }
  const id = String(formData.get("jobId") ?? "");
  if (id) await retryFailedPlatformJob(id);
  redirect("/backoffice");
}
