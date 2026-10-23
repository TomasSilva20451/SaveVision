import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { INVALID_CREDENTIALS_MESSAGE } from "@/lib/auth/login-policy";
import { loginSchema } from "@/lib/auth/login-schema";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/auth/password";
import { sessionCookie } from "@/lib/auth/session-cookie";
import { db } from "@/lib/db";

import { isLoginRateLimitBypassAllowed } from "@/lib/auth/rate-limit-policy";
import {
  assertSessionActive,
  clearLoginFailures,
  loginBlockReason,
  openAuthSession,
  registerLoginFailure,
  recordSecurityEvent,
  userNeedsSecondFactor,
  verifySecondFactor,
} from "@/server/services/auth-protection";
import { grantStepUp } from "@/lib/auth/step-up";
import { CRITICAL_JOURNEYS } from "@/lib/observability/journeys";
import { log } from "@/lib/observability/logger";
import { recordLoginMetric } from "@/lib/observability/metrics";
import { withSpan } from "@/lib/observability/tracing";
import { verifyPasskeyAuthentication } from "@/server/services/passkeys";

const cookie = sessionCookie(process.env.NODE_ENV);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  cookies: {
    sessionToken: cookie,
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Palavra-passe", type: "password" },
        totp: { label: "Código", type: "text" },
        recoveryCode: { label: "Código de recuperação", type: "text" },
        deviceId: { label: "Dispositivo", type: "text" },
        passkey: { label: "Passkey", type: "text" },
      },
      authorize: async (credentials, request) => {
        const started = performance.now();
        const finish = (result: "success" | "failure" | "blocked") => {
          const durationMs = performance.now() - started;
          recordLoginMetric(result, durationMs);
          log.info("auth.login", {
            journey: CRITICAL_JOURNEYS.login,
            event: "login_attempt",
            meta: { result, durationMs: Math.round(durationMs) },
          });
        };

        return withSpan("auth.login", async () => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          finish("failure");
          return null;
        }

        const email = parsed.data.email.trim().toLowerCase();
        const headerIp = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          || request?.headers.get("x-real-ip")
          || "local";
        const deviceId = typeof credentials?.deviceId === "string" ? credentials.deviceId : undefined;
        const userAgent = request?.headers.get("user-agent") ?? null;
        const bypass = isLoginRateLimitBypassAllowed();

        if (!bypass) {
          const blocked = await loginBlockReason({ email, ip: headerIp, deviceId });
          if (blocked) {
            finish("blocked");
            return null;
          }
        }

        const user = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            emailVerifiedAt: true,
            disabledAt: true,
          },
        });
        const passwordOk = await verifyPassword(user?.passwordHash ?? DUMMY_PASSWORD_HASH, parsed.data.password);
        if (!user || !passwordOk || user.disabledAt || !user.emailVerifiedAt) {
          if (!bypass) await registerLoginFailure({ email, ip: headerIp, deviceId });
          finish("failure");
          return null;
        }

        if (await userNeedsSecondFactor(user.id)) {
          const totp = typeof credentials?.totp === "string" ? credentials.totp : "";
          const recoveryCode = typeof credentials?.recoveryCode === "string" ? credentials.recoveryCode : "";
          let factorOk = await verifySecondFactor(user.id, { totp, recoveryCode });
          if (!factorOk && typeof credentials?.passkey === "string" && credentials.passkey.length > 2) {
            const origin = request?.headers.get("origin") ?? `http://${request?.headers.get("host") ?? "localhost"}`;
            const host = request?.headers.get("host") ?? "localhost";
            try {
              factorOk = await verifyPasskeyAuthentication({
                userId: user.id,
                host,
                origin,
                response: JSON.parse(credentials.passkey),
              });
            } catch {
              factorOk = false;
            }
          }
          if (!factorOk) {
            if (!bypass) await registerLoginFailure({ email, ip: headerIp, deviceId });
            finish("failure");
            return null;
          }
          await grantStepUp(user.id);
          await recordSecurityEvent({
            userId: user.id,
            email,
            type: "STEP_UP",
            ip: headerIp,
            deviceId,
            metadata: { source: "login_mfa" },
          });
        }

        if (!bypass) await clearLoginFailures({ email, ip: headerIp, deviceId });
        const session = await openAuthSession({ userId: user.id, userAgent, ip: headerIp, deviceId });
        await recordSecurityEvent({ userId: user.id, email, type: "LOGIN_SUCCESS", ip: headerIp, deviceId });
        finish("success");
        return { id: user.id, email: user.email, name: user.name, sessionId: session.id };
        });
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.sessionId = typeof user.sessionId === "string" ? user.sessionId : undefined;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      session.sessionId = typeof token.sessionId === "string" ? token.sessionId : undefined;
      return session;
    },
  },
});

export async function requireAuthenticatedUser() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const active = await assertSessionActive(session.user.id, session.sessionId);
  if (!active) return null;

  return db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, avatarUrl: true },
  });
}

export { INVALID_CREDENTIALS_MESSAGE };
