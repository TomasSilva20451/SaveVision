"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { auth, signIn, signOut } from "@/lib/auth/auth";
import { INVALID_CREDENTIALS_MESSAGE, TOO_MANY_ATTEMPTS_MESSAGE } from "@/lib/auth/login-policy";
import { loginCredentialsSchema, loginMfaSchema } from "@/lib/auth/login-schema";
import { isLoginRateLimitBypassAllowed } from "@/lib/auth/rate-limit-policy";
import {
  assertLoginMfaChallengeForEmail,
  issueLoginMfaChallenge,
  recordLoginMfaChallengeFailure,
  revokeLoginMfaChallenge,
  type LoginMfaGate,
} from "@/lib/auth/login-mfa-challenge";
import { MFA_TOTP_INVALID_MESSAGE, MFA_TOTP_NETWORK_MESSAGE } from "@/lib/auth/totp-messages";
import {
  loginBlockReason,
  peekLoginState,
  registerLoginFailure,
  revokeAuthSession,
} from "@/server/services/auth-protection";

export type LoginMfaKind = "totp" | "passkey" | "either";

export type LoginFlowState =
  | {
      step: "credentials";
      error: string | null;
      fieldErrors: { email?: string; password?: string };
    }
  | {
      step: "mfa";
      error: string | null;
      mfaError: string | null;
      mfaKind: LoginMfaKind;
      challengeToken: string;
      email: string;
      recoveryMode: boolean;
      totpResetNonce: number;
      fieldErrors: Record<string, never>;
    };

const credentialsInitial: LoginFlowState = {
  step: "credentials",
  error: null,
  fieldErrors: {},
};

function mfaKindFromGate(gate: LoginMfaGate): LoginMfaKind {
  if (gate === "mfa-passkey") return "passkey";
  if (gate === "mfa-either") return "either";
  return "totp";
}

async function requestIpAndDevice(formData: FormData) {
  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip") ||
    "local";
  const deviceId = String(formData.get("deviceId") ?? "") || undefined;
  return { ip, deviceId };
}

function gateToMfaGate(gate: Awaited<ReturnType<typeof peekLoginState>>): LoginMfaGate | null {
  if (gate === "mfa-totp" || gate === "mfa-passkey" || gate === "mfa-either") return gate;
  return null;
}

export async function loginCredentialsAction(
  _previous: LoginFlowState,
  formData: FormData,
): Promise<LoginFlowState> {
  const parsed = loginCredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    deviceId: String(formData.get("deviceId") ?? "") || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: { email?: string; password?: string } = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "email" || field === "password") fieldErrors[field] = issue.message;
    }
    return { step: "credentials", error: null, fieldErrors };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const { ip, deviceId } = await requestIpAndDevice(formData);

  if (!isLoginRateLimitBypassAllowed()) {
    const blocked = await loginBlockReason({ email, ip, deviceId });
    if (blocked) {
      return { step: "credentials", error: TOO_MANY_ATTEMPTS_MESSAGE, fieldErrors: {} };
    }
  }

  const gate = await peekLoginState(email, parsed.data.password);
  if (gate === "invalid") {
    if (!isLoginRateLimitBypassAllowed()) {
      await registerLoginFailure({ email, ip, deviceId });
    }
    return { step: "credentials", error: INVALID_CREDENTIALS_MESSAGE, fieldErrors: {} };
  }
  if (gate === "disabled") {
    return { step: "credentials", error: INVALID_CREDENTIALS_MESSAGE, fieldErrors: {} };
  }
  if (gate === "unverified") {
    return {
      step: "credentials",
      error: "Confirma o email antes de entrar. Pede um novo link em Recuperar conta.",
      fieldErrors: {},
    };
  }

  const mfaGate = gateToMfaGate(gate);
  if (mfaGate) {
    const user = await import("@/lib/db").then((m) =>
      m.db.user.findUnique({ where: { email }, select: { id: true } }),
    );
    if (!user) {
      return { step: "credentials", error: INVALID_CREDENTIALS_MESSAGE, fieldErrors: {} };
    }
    const challengeToken = await issueLoginMfaChallenge({
      userId: user.id,
      mfaGate,
      ip,
      deviceId,
    });
    return {
      step: "mfa",
      error: null,
      mfaError: null,
      mfaKind: mfaKindFromGate(mfaGate),
      challengeToken,
      email,
      recoveryMode: false,
      totpResetNonce: 0,
      fieldErrors: {},
    };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      deviceId,
      redirectTo: "/inicio",
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof AuthError) {
      return { step: "credentials", error: INVALID_CREDENTIALS_MESSAGE, fieldErrors: {} };
    }
    throw error;
  }

  return credentialsInitial;
}

export async function loginMfaAction(
  previous: LoginFlowState,
  formData: FormData,
): Promise<LoginFlowState> {
  if (previous.step !== "mfa") {
    return { step: "credentials", error: "Inicia sessão novamente.", fieldErrors: {} };
  }

  const parsed = loginMfaSchema.safeParse({
    email: formData.get("email") ?? previous.email,
    mfaChallengeToken: formData.get("mfaChallengeToken") ?? previous.challengeToken,
    totp: String(formData.get("totp") ?? "") || undefined,
    recoveryCode: String(formData.get("recoveryCode") ?? "") || undefined,
    deviceId: String(formData.get("deviceId") ?? "") || undefined,
    passkey: String(formData.get("passkey") ?? "") || undefined,
  });

  const recoveryMode = String(formData.get("recoveryMode") ?? "") === "1" || previous.recoveryMode;

  if (!parsed.success) {
    return {
      ...previous,
      mfaError: "Introduz um código válido.",
    };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const { ip, deviceId } = await requestIpAndDevice(formData);

  if (!isLoginRateLimitBypassAllowed()) {
    const blocked = await loginBlockReason({ email, ip, deviceId });
    if (blocked) {
      return {
        ...previous,
        email,
        recoveryMode,
        error: TOO_MANY_ATTEMPTS_MESSAGE,
        mfaError: null,
      };
    }
  }

  const challenge = await assertLoginMfaChallengeForEmail(parsed.data.mfaChallengeToken, email);
  if (!challenge) {
    return {
      step: "credentials",
      error: "A verificação expirou. Introduz email e palavra-passe novamente.",
      fieldErrors: {},
    };
  }

  if (!parsed.data.totp && !parsed.data.recoveryCode && !parsed.data.passkey) {
    return {
      ...previous,
      email,
      challengeToken: parsed.data.mfaChallengeToken,
      recoveryMode,
      mfaError: recoveryMode ? "Introduz um código de recuperação." : "Introduz o código de 6 dígitos.",
    };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: "",
      mfaChallengeToken: parsed.data.mfaChallengeToken,
      totp: parsed.data.totp,
      recoveryCode: parsed.data.recoveryCode,
      passkey: parsed.data.passkey,
      deviceId,
      redirectTo: "/inicio",
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (!(error instanceof AuthError)) {
    return {
      ...previous,
      email,
      challengeToken: parsed.data.mfaChallengeToken,
      recoveryMode,
      mfaError: MFA_TOTP_NETWORK_MESSAGE,
      totpResetNonce: previous.totpResetNonce,
    };
    }
    await recordLoginMfaChallengeFailure(challenge.id);
    if (!isLoginRateLimitBypassAllowed()) {
      await registerLoginFailure({ email, ip, deviceId });
    }
    const expired = !(await assertLoginMfaChallengeForEmail(parsed.data.mfaChallengeToken, email));
    if (expired) {
      return {
        step: "credentials",
        error: "A verificação expirou. Introduz email e palavra-passe novamente.",
        fieldErrors: {},
      };
    }
    return {
      ...previous,
      email,
      challengeToken: parsed.data.mfaChallengeToken,
      recoveryMode,
      mfaError: MFA_TOTP_INVALID_MESSAGE,
      totpResetNonce: previous.totpResetNonce + 1,
    };
  }

  return credentialsInitial;
}

export async function loginMfaToggleRecoveryAction(
  previous: LoginFlowState,
  formData: FormData,
): Promise<LoginFlowState> {
  if (previous.step !== "mfa") return credentialsInitial;
  const enable = String(formData.get("recoveryMode") ?? "") === "1";
  return {
    ...previous,
    recoveryMode: enable,
    mfaError: null,
    totpResetNonce: enable ? previous.totpResetNonce : previous.totpResetNonce + 1,
  };
}

export async function loginCancelMfaAction(
  previous: LoginFlowState,
  formData: FormData,
): Promise<LoginFlowState> {
  if (previous.step === "mfa") {
    const token = String(formData.get("mfaChallengeToken") ?? previous.challengeToken);
    await revokeLoginMfaChallenge(token);
  }
  return credentialsInitial;
}

export async function loginFlowAction(
  previous: LoginFlowState,
  formData: FormData,
): Promise<LoginFlowState> {
  const intent = String(formData.get("intent") ?? "credentials");
  if (intent === "mfa") return loginMfaAction(previous, formData);
  if (intent === "cancel-mfa") return loginCancelMfaAction(previous, formData);
  if (intent === "toggle-recovery") return loginMfaToggleRecoveryAction(previous, formData);
  return loginCredentialsAction(previous, formData);
}

export async function logoutAction() {
  const session = await auth();
  if (session?.user?.id && session.sessionId) {
    await revokeAuthSession(session.user.id, session.sessionId);
  }
  await signOut({ redirectTo: "/login" });
}

/** @deprecated Use loginFlowAction */
export type LoginState = LoginFlowState;
