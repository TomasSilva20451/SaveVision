"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { auth, signIn, signOut } from "@/lib/auth/auth";
import { INVALID_CREDENTIALS_MESSAGE, TOO_MANY_ATTEMPTS_MESSAGE } from "@/lib/auth/login-policy";
import { loginSchema } from "@/lib/auth/login-schema";
import { isLoginRateLimitBypassAllowed } from "@/lib/auth/rate-limit-policy";
import { loginBlockReason, peekLoginState, revokeAuthSession } from "@/server/services/auth-protection";

export type LoginState = {
  error: string | null;
  mfaRequired: null | "totp" | "passkey" | "either";
  fieldErrors: {
    email?: string;
    password?: string;
  };
};

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    totp: String(formData.get("totp") ?? "") || undefined,
    recoveryCode: String(formData.get("recoveryCode") ?? "") || undefined,
    deviceId: String(formData.get("deviceId") ?? "") || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: LoginState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "email" || field === "password") fieldErrors[field] = issue.message;
    }
    return { error: null, mfaRequired: null, fieldErrors };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim()
    || headerStore.get("x-real-ip")
    || "local";
  if (!isLoginRateLimitBypassAllowed()) {
    const blocked = await loginBlockReason({ email, ip, deviceId: parsed.data.deviceId });
    if (blocked) return { error: TOO_MANY_ATTEMPTS_MESSAGE, mfaRequired: null, fieldErrors: {} };
  }

  const gate = await peekLoginState(email, parsed.data.password);
  if (gate === "disabled") {
    return { error: "Esta conta está desactivada.", mfaRequired: null, fieldErrors: {} };
  }
  if (gate === "unverified") {
    return {
      error: "Confirma o email antes de entrar. Pede um novo link em Recuperar conta.",
      mfaRequired: null,
      fieldErrors: {},
    };
  }
  if (gate === "mfa-totp" || gate === "mfa-passkey" || gate === "mfa-either") {
    const hasFactor = Boolean(parsed.data.totp || parsed.data.recoveryCode || formData.get("passkey"));
    if (!hasFactor) {
      return {
        error: "Introduz o código TOTP ou de recuperação (ou passkey) e volta a carregar em Entrar — não precisas de alterar email nem palavra-passe.",
        mfaRequired: gate === "mfa-totp" ? "totp" : gate === "mfa-passkey" ? "passkey" : "either",
        fieldErrors: {},
      };
    }
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      totp: parsed.data.totp,
      recoveryCode: parsed.data.recoveryCode,
      deviceId: parsed.data.deviceId,
      passkey: String(formData.get("passkey") ?? ""),
      redirectTo: "/inicio",
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof AuthError) {
      return { error: INVALID_CREDENTIALS_MESSAGE, mfaRequired: null, fieldErrors: {} };
    }
    throw error;
  }

  return { error: null, mfaRequired: null, fieldErrors: {} };
}

export async function logoutAction() {
  const session = await auth();
  if (session?.user?.id && session.sessionId) {
    await revokeAuthSession(session.user.id, session.sessionId);
  }
  await signOut({ redirectTo: "/login" });
}
