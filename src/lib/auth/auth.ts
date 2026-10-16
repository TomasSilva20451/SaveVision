import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { writeAttempt, readAttempt } from "@/lib/auth/attempt-store";
import {
  authenticateCredentials,
  INVALID_CREDENTIALS_MESSAGE,
} from "@/lib/auth/login-policy";
import { loginSchema } from "@/lib/auth/login-schema";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/auth/password";
import { sessionCookie } from "@/lib/auth/session-cookie";
import { db } from "@/lib/db";

import { isLoginRateLimitBypassAllowed } from "@/lib/auth/rate-limit-policy";

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
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const email = parsed.data.email.trim().toLowerCase();
        const decision = await authenticateCredentials(
          { email, password: parsed.data.password },
          {
            now: Date.now(),
            attempt: isLoginRateLimitBypassAllowed()
              ? undefined
              : readAttempt(email),
            dummyHash: DUMMY_PASSWORD_HASH,
            findUser: (lookup) =>
              db.user.findUnique({
                where: { email: lookup },
                select: {
                  id: true,
                  email: true,
                  name: true,
                  passwordHash: true,
                },
              }),
            verify: verifyPassword,
          },
        );

        if (!isLoginRateLimitBypassAllowed()) {
          writeAttempt(email, decision.attempt);
        }

        if (!decision.result.ok) {
          return null;
        }

        return decision.result.user;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }

      return session;
    },
  },
});

export async function requireAuthenticatedUser() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id || !user.email || !user.name) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}

export { INVALID_CREDENTIALS_MESSAGE };
