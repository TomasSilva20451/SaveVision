"use server";

import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { canBackoffice, type PlatformRole } from "@/lib/platform/backoffice-policy";
import { createPlatformUserSchema } from "@/lib/platform/platform-user-schema";
import { setFlash } from "@/lib/ui/flash";
import { db } from "@/lib/db";
import { provisionPlatformUser } from "@/server/services/platform-users";
import { retryFailedPlatformJob } from "@/server/services/platform-jobs";

async function platformRoleFor(userId: string): Promise<PlatformRole | null> {
  const row = await db.user.findUnique({ where: { id: userId }, select: { systemRole: true } });
  return row ? (row.systemRole as PlatformRole) : null;
}

export async function retryPlatformJobAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");
  const role = await platformRoleFor(user.id);
  if (!role || !canBackoffice(role, "retry-jobs")) {
    redirect("/backoffice");
  }
  const id = String(formData.get("jobId") ?? "");
  if (id) await retryFailedPlatformJob(id);
  redirect("/backoffice");
}

export async function createPlatformUserAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");
  const role = await platformRoleFor(user.id);
  if (!role || !canBackoffice(role, "manage-users")) {
    await setFlash({ type: "error", text: "Sem permissão para criar contas.", targetPath: "/backoffice" });
    redirect("/backoffice");
  }

  const parsed = createPlatformUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dados inválidos.";
    await setFlash({ type: "error", text: message, targetPath: "/backoffice" });
    redirect("/backoffice");
  }

  const result = await provisionPlatformUser(user.id, parsed.data);
  if (!result.ok) {
    await setFlash({ type: "error", text: result.error, targetPath: "/backoffice" });
    redirect("/backoffice");
  }

  await setFlash({
    type: "success",
    text: `Conta criada: ${parsed.data.email}. O utilizador pode entrar em /login.`,
    targetPath: "/backoffice",
  });
  redirect("/backoffice");
}
