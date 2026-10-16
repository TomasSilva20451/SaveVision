"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { setActiveWorkspace } from "@/server/services/workspace-context";

export async function selectWorkspaceAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const workspaceId = formData.get("workspaceId");

  if (!user || typeof workspaceId !== "string") {
    return;
  }

  const ok = await setActiveWorkspace(user.id, workspaceId);

  if (!ok) {
    return;
  }

  revalidatePath("/inicio");
}
