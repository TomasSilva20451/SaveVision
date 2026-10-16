export const WORKSPACE_COOKIE = "fintwin_workspace";

export function workspaceCookieOptions(nodeEnv: string | undefined) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: nodeEnv === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}
