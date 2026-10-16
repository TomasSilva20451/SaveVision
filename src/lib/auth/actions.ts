"use server";

import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { signIn, signOut } from "@/lib/auth/auth";
import { readAttempt } from "@/lib/auth/attempt-store";
import {
  INVALID_CREDENTIALS_MESSAGE,
  TOO_MANY_ATTEMPTS_MESSAGE,
  isLoginBlocked,
} from "@/lib/auth/login-policy";
import { loginSchema } from "@/lib/auth/login-schema";

export type LoginState = {
  error: string | null;
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
  });

  if (!parsed.success) {
    const fieldErrors: LoginState["fieldErrors"] = {};

    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "email" || field === "password") {
        fieldErrors[field] = issue.message;
      }
    }

    return { error: null, fieldErrors };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const { isLoginRateLimitBypassAllowed } = await import(
    "@/lib/auth/rate-limit-policy"
  );
  const bypass = isLoginRateLimitBypassAllowed();
  const attempt = bypass ? undefined : readAttempt(email);

  if (!bypass && isLoginBlocked(attempt, Date.now())) {
    return {
      error: TOO_MANY_ATTEMPTS_MESSAGE,
      fieldErrors: {},
    };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/inicio",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof AuthError) {
      const blocked =
        !bypass && isLoginBlocked(readAttempt(email), Date.now());
      return {
        error: blocked ? TOO_MANY_ATTEMPTS_MESSAGE : INVALID_CREDENTIALS_MESSAGE,
        fieldErrors: {},
      };
    }

    throw error;
  }

  return { error: null, fieldErrors: {} };
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
