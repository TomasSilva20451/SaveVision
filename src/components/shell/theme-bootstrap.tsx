"use client";

import { useLayoutEffect } from "react";
import { themeCookieHeader, THEME_COOKIE } from "@/lib/ui/theme";

function readPreferredDark(): boolean {
  const cookiePair = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${THEME_COOKIE}=`));
  const cookieValue = cookiePair?.split("=")[1];
  if (cookieValue === "dark" || cookieValue === "light") {
    return cookieValue === "dark";
  }
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") {
      return stored === "dark";
    }
  } catch {
    /* ignore */
  }
  // Modo claro é a identidade principal; escuro só se o utilizador escolher explicitamente.
  return false;
}

/** Aplica a classe `dark` após hidratação do `<html>` (evita mismatch SSR). */
export function ThemeBootstrap() {
  useLayoutEffect(() => {
    const dark = readPreferredDark();
    document.documentElement.classList.toggle("dark", dark);
    if (!document.cookie.includes(`${THEME_COOKIE}=`)) {
      document.cookie = themeCookieHeader(dark ? "dark" : "light");
    }
  }, []);

  return null;
}
