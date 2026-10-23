"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { hasStepUp, STEP_UP_REQUIRED_MESSAGE } from "@/lib/auth/step-up";
import { civilDateIsoToInstant } from "@/lib/datetime/civil-date";
import { db } from "@/lib/db";
import { setFlash } from "@/lib/ui/flash";
import {
  canRevealEmailVerificationLinksInUi,
  emailVerificationDevLinkHint,
} from "@/lib/auth/email-delivery";
import { issueEmailChallenge } from "@/server/services/auth-protection";

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);

const profileSchema = z.object({
  name: z.string().trim().min(2, "Indica um nome com pelo menos 2 caracteres.").max(80),
  email: z.email("Indica um email válido.").transform((value) => value.trim().toLowerCase()),
  phone: optionalText(30),
  birthDate: z.string().trim().regex(/^$|^\d{4}-\d{2}-\d{2}$/, "Indica uma data válida."),
  avatarUrl: z.string().trim().max(500).refine((value) => {
    if (!value) return true;
    if (/^\/avatars\/[a-zA-Z0-9._-]+$/.test(value)) return true;
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "Usa um endereço de imagem HTTPS ou uma imagem local válida."),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(14, "A nova palavra-passe precisa de pelo menos 14 caracteres."),
  confirmPassword: z.string().min(1),
}).refine((data) => data.newPassword === data.confirmPassword, {
  path: ["confirmPassword"],
  message: "A confirmação não coincide com a nova palavra-passe.",
});

async function fail(message: string): Promise<never> {
  await setFlash({ type: "error", text: message, targetPath: "/perfil" });
  redirect("/perfil");
}

/** Sem SMTP: gera um link de uso único para confirmar alteração de email pendente (dev/local). */
export async function createEmailChangeVerificationLinkAction(): Promise<
  { ok: true; path: string } | { ok: false; error: string }
> {
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const pending = await db.emailChallenge.findFirst({
    where: {
      userId: user.id,
      purpose: "VERIFY_EMAIL",
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { email: true },
  });
  if (!pending) {
    return { ok: false, error: "Não há alteração de email pendente." };
  }

  if (!canRevealEmailVerificationLinksInUi()) {
    return {
      ok: false,
      error: "O envio por email está activo — confirma pela caixa de entrada. Se não recebeste nada, verifica spam ou contacta o administrador.",
    };
  }

  const challenge = await issueEmailChallenge({
    userId: user.id,
    email: pending.email,
    purpose: "VERIFY_EMAIL",
  });
  return { ok: true, path: `/verificar-email?token=${challenge.token}` };
}

export async function updateProfileAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    birthDate: formData.get("birthDate") ?? "",
    avatarUrl: formData.get("avatarUrl") ?? "",
  });
  if (!parsed.success) {
    await fail(parsed.error.issues[0]?.message ?? "Não foi possível guardar o perfil.");
    return;
  }
  const data = parsed.data;

  const current = await db.user.findUnique({ where: { id: user.id }, select: { email: true } });
  const emailOwner = await db.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (emailOwner && emailOwner.id !== user.id) await fail("Este email já pertence a outra conta.");

  let birthDate: Date | null = null;
  if (data.birthDate) {
    try {
      birthDate = civilDateIsoToInstant(data.birthDate);
    } catch {
      await fail("A data de nascimento não é válida.");
    }
  }

  const emailChanged = current?.email !== data.email;
  if (emailChanged && !(await hasStepUp(user.id))) await fail(STEP_UP_REQUIRED_MESSAGE);

  await db.user.update({
    where: { id: user.id },
    data: {
      name: data.name,
      email: emailChanged ? current?.email : data.email,
      phone: data.phone,
      birthDate,
      avatarUrl: data.avatarUrl || null,
    },
  });

  if (emailChanged) {
    const challenge = await issueEmailChallenge({ userId: user.id, email: data.email, purpose: "VERIFY_EMAIL" });
    const dev = emailVerificationDevLinkHint(`/verificar-email?token=${challenge.token}`);
    await setFlash({
      type: "success",
      text: `Guardámos nome e restantes dados. O email só muda depois de confirmares ${data.email}.${dev}`,
      targetPath: "/perfil",
    });
    redirect("/perfil");
  }
  revalidatePath("/", "layout");
  await setFlash({ type: "success", text: "Perfil atualizado com sucesso.", targetPath: "/perfil" });
  redirect("/perfil");
}

export async function updatePasswordAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Não foi possível alterar a palavra-passe.");
  if (!(await hasStepUp(user.id))) await fail(STEP_UP_REQUIRED_MESSAGE);

  const stored = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!stored || !(await verifyPassword(stored.passwordHash, parsed.data.currentPassword))) {
    await fail("A palavra-passe atual não está correta.");
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });
  await setFlash({ type: "success", text: "Palavra-passe alterada com sucesso.", targetPath: "/perfil" });
  redirect("/perfil");
}
