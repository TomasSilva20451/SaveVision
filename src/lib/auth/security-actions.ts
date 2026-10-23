"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { hashPassword } from "@/lib/auth/password";
import { grantStepUp, hasStepUp, STEP_UP_REQUIRED_MESSAGE } from "@/lib/auth/step-up";
import { db } from "@/lib/db";
import { setFlash } from "@/lib/ui/flash";
import { emailVerificationDevLinkHint } from "@/lib/auth/email-delivery";
import {
  beginTotpEnrollment,
  confirmTotpEnrollment,
  consumeEmailChallenge,
  disableTotp,
  issueEmailChallenge,
  passwordMatches,
  peekLoginState,
  readEmailChallenge,
  recordSecurityEvent,
  regenerateRecoveryCodes,
  revokeAllAuthSessions,
  revokeAuthSession,
  verifySecondFactor,
} from "@/server/services/auth-protection";
import {
  beginPasskeyAuthentication,
  beginPasskeyRegistration,
  finishPasskeyRegistration,
} from "@/server/services/passkeys";

async function viewer() {
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");
  return user;
}

async function requestOrigin() {
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost";
  const proto = headerStore.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return { host, origin: `${proto}://${host}` };
}

export type StepUpConfirmState = { error: string | null; ok: boolean };

export async function confirmStepUpFormAction(
  _previous: StepUpConfirmState,
  formData: FormData,
): Promise<StepUpConfirmState> {
  const user = await viewer();
  const password = String(formData.get("password") ?? "");
  const totp = String(formData.get("totp") ?? "").trim();
  if (!(await passwordMatches(user.id, password))) {
    return { error: "Palavra-passe incorrecta.", ok: false };
  }
  const needsFactor = await db.userTotpCredential.findUnique({ where: { userId: user.id }, select: { enabledAt: true } });
  if (needsFactor?.enabledAt && !(await verifySecondFactor(user.id, { totp }))) {
    return { error: "Código TOTP inválido.", ok: false };
  }
  await grantStepUp(user.id);
  await recordSecurityEvent({ userId: user.id, type: "STEP_UP" });
  return { error: null, ok: true };
}

export async function confirmStepUpAction(formData: FormData) {
  const result = await confirmStepUpFormAction({ error: null, ok: false }, formData);
  if (!result.ok) {
    await setFlash({ type: "error", text: result.error ?? STEP_UP_REQUIRED_MESSAGE, targetPath: "/perfil/seguranca" });
    redirect("/perfil/seguranca");
  }
  await setFlash({ type: "success", text: "Identidade confirmada durante 10 minutos.", targetPath: "/perfil/seguranca" });
  redirect("/perfil/seguranca");
}

async function ensureStepUp(userId: string) {
  if (await hasStepUp(userId)) return;
  await setFlash({ type: "error", text: STEP_UP_REQUIRED_MESSAGE, targetPath: "/perfil/seguranca" });
  redirect("/perfil/seguranca");
}

export async function sendEmailVerificationAction() {
  const user = await viewer();
  await ensureStepUp(user.id);
  const profile = await db.user.findUnique({ where: { id: user.id }, select: { email: true } });
  if (!profile) redirect("/login");
  const challenge = await issueEmailChallenge({ userId: user.id, email: profile.email, purpose: "VERIFY_EMAIL" });
  await setFlash({
    type: "success",
    text: `Pedido de verificação criado.${emailVerificationDevLinkHint(`/verificar-email?token=${challenge.token}`)}`,
    targetPath: "/perfil/seguranca",
  });
  redirect("/perfil/seguranca");
}

export type TotpBeginState = {
  error: string | null;
  secret: string | null;
  uri: string | null;
};

export async function beginTotpFormAction(_previous: TotpBeginState): Promise<TotpBeginState> {
  void _previous;
  const user = await viewer();
  if (!(await hasStepUp(user.id))) {
    return { error: STEP_UP_REQUIRED_MESSAGE, secret: null, uri: null };
  }
  const profile = await db.user.findUnique({ where: { id: user.id }, select: { email: true } });
  if (!profile) redirect("/login");
  const enrollment = await beginTotpEnrollment(user.id, profile.email);
  return { error: null, secret: enrollment.secret, uri: enrollment.uri };
}

/** @deprecated prefer beginTotpFormAction no painel MFA */
export async function beginTotpAction() {
  const user = await viewer();
  await ensureStepUp(user.id);
  const profile = await db.user.findUnique({ where: { id: user.id }, select: { email: true } });
  if (!profile) redirect("/login");
  const enrollment = await beginTotpEnrollment(user.id, profile.email);
  await setFlash({
    type: "success",
    text: `Segredo TOTP: ${enrollment.secret}. URI: ${enrollment.uri}`,
    targetPath: "/perfil/seguranca",
  });
  redirect("/perfil/seguranca");
}

export type TotpConfirmState = {
  error: string | null;
  recoveryCodes: string[] | null;
};

export async function confirmTotpFormAction(
  _previous: TotpConfirmState,
  formData: FormData,
): Promise<TotpConfirmState> {
  const user = await viewer();
  if (!(await hasStepUp(user.id))) {
    return { error: STEP_UP_REQUIRED_MESSAGE, recoveryCodes: null };
  }
  const codes = await confirmTotpEnrollment(user.id, String(formData.get("code") ?? "").trim());
  if (!codes) {
    return { error: "Código inválido. Confirma que geraste o segredo e que o relógio do telemóvel está correcto.", recoveryCodes: null };
  }
  return { error: null, recoveryCodes: codes };
}

export async function confirmTotpAction(formData: FormData) {
  const user = await viewer();
  await ensureStepUp(user.id);
  const codes = await confirmTotpEnrollment(user.id, String(formData.get("code") ?? ""));
  if (!codes) {
    await setFlash({ type: "error", text: "Código inválido. Gera o segredo e tenta outra vez.", targetPath: "/perfil/seguranca" });
    redirect("/perfil/seguranca");
  }
  await setFlash({
    type: "success",
    text: `MFA activo. Códigos de recuperação (guarda-os agora): ${codes.join(" ")}`,
    targetPath: "/perfil/seguranca",
  });
  redirect("/perfil/seguranca");
}

export async function disableTotpAction() {
  const user = await viewer();
  await ensureStepUp(user.id);
  await disableTotp(user.id);
  await setFlash({ type: "success", text: "MFA TOTP desactivado.", targetPath: "/perfil/seguranca" });
  redirect("/perfil/seguranca");
}

export async function regenerateRecoveryCodesAction() {
  const user = await viewer();
  await ensureStepUp(user.id);
  const totp = await db.userTotpCredential.findUnique({ where: { userId: user.id }, select: { enabledAt: true } });
  if (!totp?.enabledAt) {
    await setFlash({ type: "error", text: "Activa o TOTP antes de gerar códigos.", targetPath: "/perfil/seguranca" });
    redirect("/perfil/seguranca");
  }
  const codes = await regenerateRecoveryCodes(user.id);
  await setFlash({
    type: "success",
    text: `Novos códigos de recuperação: ${codes.join(" ")}`,
    targetPath: "/perfil/seguranca",
  });
  redirect("/perfil/seguranca");
}

export async function revokeSessionAction(formData: FormData) {
  const user = await viewer();
  await ensureStepUp(user.id);
  await revokeAuthSession(user.id, String(formData.get("sessionId") ?? ""));
  await setFlash({ type: "success", text: "Sessão revogada.", targetPath: "/perfil/seguranca" });
  redirect("/perfil/seguranca");
}

export async function globalLogoutAction() {
  const user = await viewer();
  await ensureStepUp(user.id);
  await revokeAllAuthSessions(user.id);
  const { signOut } = await import("@/lib/auth/auth");
  await signOut({ redirectTo: "/login" });
}

export async function disableAccountAction(formData: FormData) {
  const user = await viewer();
  await ensureStepUp(user.id);
  const password = String(formData.get("password") ?? "");
  if (String(formData.get("confirm") ?? "") !== "DESACTIVAR") {
    await setFlash({ type: "error", text: "Escreve DESACTIVAR para confirmar.", targetPath: "/perfil/seguranca" });
    redirect("/perfil/seguranca");
  }
  if (!(await passwordMatches(user.id, password))) {
    await setFlash({ type: "error", text: "Palavra-passe incorrecta.", targetPath: "/perfil/seguranca" });
    redirect("/perfil/seguranca");
  }
  await db.user.update({ where: { id: user.id }, data: { disabledAt: new Date() } });
  await revokeAllAuthSessions(user.id);
  await recordSecurityEvent({ userId: user.id, type: "ACCOUNT_DISABLED" });
  const { signOut } = await import("@/lib/auth/auth");
  await signOut({ redirectTo: "/login" });
}

export async function changePasswordAction(formData: FormData) {
  const user = await viewer();
  await ensureStepUp(user.id);
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (next.length < 14 || next !== confirm) {
    await setFlash({ type: "error", text: "A nova palavra-passe precisa de 14 caracteres e de coincidir.", targetPath: "/perfil/seguranca" });
    redirect("/perfil/seguranca");
  }
  if (!(await passwordMatches(user.id, String(formData.get("currentPassword") ?? "")))) {
    await setFlash({ type: "error", text: "Palavra-passe actual incorrecta.", targetPath: "/perfil/seguranca" });
    redirect("/perfil/seguranca");
  }
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  await recordSecurityEvent({ userId: user.id, type: "PASSWORD_CHANGED" });
  await setFlash({ type: "success", text: "Palavra-passe alterada.", targetPath: "/perfil/seguranca" });
  redirect("/perfil/seguranca");
}

export async function requestAccountRecoveryAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const user = email ? await db.user.findUnique({ where: { email }, select: { id: true, email: true, disabledAt: true } }) : null;
  if (user && !user.disabledAt) {
    const challenge = await issueEmailChallenge({ userId: user.id, email: user.email, purpose: "RECOVER_ACCOUNT" });
    if (process.env.NODE_ENV !== "production") {
      console.info(`[fintwin] recuperação ${user.email}: /recuperar-conta?token=${challenge.token}`);
    }
  }
  await setFlash({
    type: "success",
    text: "Se a conta existir, preparámos um link de recuperação válido por 15 minutos.",
    targetPath: "/recuperar-conta",
  });
  redirect("/recuperar-conta");
}

export async function completeAccountRecoveryAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const recoveryCode = String(formData.get("recoveryCode") ?? "");
  const totp = String(formData.get("totp") ?? "");
  if (next.length < 14) {
    await setFlash({ type: "error", text: "A palavra-passe precisa de pelo menos 14 caracteres.", targetPath: "/recuperar-conta" });
    redirect("/recuperar-conta");
  }
  const challenge = await readEmailChallenge(token, "RECOVER_ACCOUNT");
  if (!challenge) {
    await setFlash({ type: "error", text: "Link inválido ou expirado.", targetPath: "/recuperar-conta" });
    redirect("/recuperar-conta");
  }
  const needsFactor = await db.userTotpCredential.findUnique({
    where: { userId: challenge.userId },
    select: { enabledAt: true },
  });
  if (needsFactor?.enabledAt && !(await verifySecondFactor(challenge.userId, { totp, recoveryCode }))) {
    await setFlash({ type: "error", text: "Confirma com um código TOTP ou de recuperação.", targetPath: "/recuperar-conta" });
    redirect(`/recuperar-conta?token=${token}`);
  }
  await consumeEmailChallenge(token, "RECOVER_ACCOUNT");
  await db.user.update({
    where: { id: challenge.userId },
    data: { passwordHash: await hashPassword(next), emailVerifiedAt: new Date(), disabledAt: null },
  });
  await revokeAllAuthSessions(challenge.userId);
  await recordSecurityEvent({ userId: challenge.userId, type: "ACCOUNT_RECOVERY_COMPLETED" });
  await setFlash({ type: "success", text: "Palavra-passe reposta. Entra com a nova credencial.", targetPath: "/login" });
  redirect("/login");
}

export async function verifyEmailTokenAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const challenge = await consumeEmailChallenge(token, "VERIFY_EMAIL");
  if (!challenge) {
    await setFlash({ type: "error", text: "Link de verificação inválido ou expirado.", targetPath: "/login" });
    redirect("/login");
  }
  await db.user.update({
    where: { id: challenge.userId },
    data: { email: challenge.email, emailVerifiedAt: new Date() },
  });
  await recordSecurityEvent({ userId: challenge.userId, email: challenge.email, type: "EMAIL_VERIFIED" });
  await setFlash({ type: "success", text: "Email confirmado.", targetPath: "/login" });
  redirect("/login");
}

export async function beginPasskeyRegistrationAction(): Promise<
  | { ok: true; options: Awaited<ReturnType<typeof beginPasskeyRegistration>> }
  | { ok: false; error: string }
> {
  const user = await viewer();
  if (!(await hasStepUp(user.id))) {
    return { ok: false, error: STEP_UP_REQUIRED_MESSAGE };
  }
  const profile = await db.user.findUnique({ where: { id: user.id }, select: { email: true, name: true } });
  if (!profile) redirect("/login");
  const { host } = await requestOrigin();
  const options = await beginPasskeyRegistration({ userId: user.id, email: profile.email, name: profile.name, host });
  return { ok: true, options };
}

export async function finishPasskeyRegistrationAction(response: RegistrationResponseJSON) {
  const user = await viewer();
  if (!(await hasStepUp(user.id))) return { ok: false as const, error: STEP_UP_REQUIRED_MESSAGE };
  const { host, origin } = await requestOrigin();
  const ok = await finishPasskeyRegistration({
    userId: user.id,
    host,
    origin,
    response,
    deviceLabel: "Passkey deste dispositivo",
  });
  if (ok) await recordSecurityEvent({ userId: user.id, type: "PASSKEY_REGISTERED" });
  return ok ? { ok: true as const } : { ok: false as const, error: "Não foi possível registar a passkey." };
}

export async function deletePasskeyAction(formData: FormData) {
  const user = await viewer();
  await ensureStepUp(user.id);
  await db.passkeyCredential.deleteMany({ where: { id: String(formData.get("passkeyId") ?? ""), userId: user.id } });
  await recordSecurityEvent({ userId: user.id, type: "PASSKEY_REMOVED" });
  await setFlash({ type: "success", text: "Passkey removida.", targetPath: "/perfil/seguranca" });
  redirect("/perfil/seguranca");
}

export async function startLoginPasskeyAction(email: string, password: string) {
  const gate = await peekLoginState(email, password);
  if (gate !== "mfa-passkey" && gate !== "mfa-either") return { ok: false as const, error: "Passkey indisponível." };
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
  if (!user) return { ok: false as const, error: "Passkey indisponível." };
  const { host } = await requestOrigin();
  const options = await beginPasskeyAuthentication({ userId: user.id, host });
  return { ok: true as const, options };
}

export type LoginPasskeyResponse = AuthenticationResponseJSON;
