"use client";

import { useState } from "react";
import { themeCookieHeader, type ThemeMode } from "@/lib/ui/theme";

type ThemeToggleProps = {
  initialDark: boolean;
};

export function ThemeToggle({ initialDark }: ThemeToggleProps) {
  const [dark, setDark] = useState(initialDark);

  function apply(mode: ThemeMode) {
    const next = mode === "dark";
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", mode);
    document.cookie = themeCookieHeader(mode);
    setDark(next);
  }

  function toggle() {
    apply(dark ? "light" : "dark");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-100"
    >
      {dark ? "Modo claro" : "Modo escuro"}
    </button>
  );
}
