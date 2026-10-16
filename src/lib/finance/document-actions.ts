"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";
import { uploadDocument } from "@/server/services/documents";

export async function uploadDocumentAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const bytes = new Uint8Array(await file.arrayBuffer());
  await uploadDocument(user.id, selected.id, {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    bytes,
  });
  revalidatePath("/relatorios");
}
