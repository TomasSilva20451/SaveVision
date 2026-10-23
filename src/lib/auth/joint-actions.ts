"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { setActiveWorkspace } from "@/server/services/workspace-context";
import {
  acceptWorkspaceInvite,
  createJointWorkspace,
  declineWorkspaceInvite,
  inviteToJointWorkspace,
  revokeWorkspaceInvite,
} from "@/server/services/joint-workspace";

export async function createJointWorkspaceAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;

  const parsed = z.object({ name: z.string().min(1) }).safeParse({
    name: formData.get("name"),
  });
  if (!parsed.success) return;

  const workspace = await createJointWorkspace(user.id, parsed.data.name);
  await setActiveWorkspace(user.id, workspace.id);
  revalidatePath("/conta-conjunta");
}

export async function inviteJointMemberAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;

  const parsed = z
    .object({
      workspaceId: z.string().min(1),
      email: z.string().email(),
    })
    .safeParse({
      workspaceId: formData.get("workspaceId"),
      email: formData.get("email"),
    });
  if (!parsed.success) return;

  await inviteToJointWorkspace(
    user.id,
    parsed.data.workspaceId,
    parsed.data.email,
  );
  revalidatePath("/conta-conjunta");
}

export async function acceptInviteAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;

  const parsed = z.object({ token: z.string().min(1) }).safeParse({
    token: formData.get("token"),
  });
  if (!parsed.success) return;

  const workspaceId = await acceptWorkspaceInvite(user.id, parsed.data.token);
  if (workspaceId) {
    await setActiveWorkspace(user.id, workspaceId);
  }
  revalidatePath("/conta-conjunta");
}

export async function declineInviteAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const token = String(formData.get("token") || "");
  if (!token) return;
  await declineWorkspaceInvite(user.id, token);
  revalidatePath("/conta-conjunta");
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const workspaceId = String(formData.get("workspaceId") || "");
  const inviteId = String(formData.get("inviteId") || "");
  if (!workspaceId || !inviteId) return;
  await revokeWorkspaceInvite(user.id, workspaceId, inviteId);
  revalidatePath("/conta-conjunta");
}
