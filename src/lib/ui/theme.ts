export const THEME_COOKIE = "fintwin_theme";

export type ThemeMode = "light" | "dark";

export function isDarkThemeCookie(value: string | undefined): boolean {
  return value === "dark";
}

export function themeCookieHeader(mode: ThemeMode): string {
  return `${THEME_COOKIE}=${mode}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
