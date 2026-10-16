export function sessionCookie(nodeEnv: string | undefined) {
  const secure = nodeEnv === "production";

  return {
    name: secure ? "__Secure-authjs.session-token" : "authjs.session-token",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure,
      path: "/",
    },
  };
}
