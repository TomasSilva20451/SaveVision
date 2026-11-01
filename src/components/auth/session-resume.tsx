"use client";

import { useEffect } from "react";
import { isPublicAuthPath, SESSION_RESUME_RELOAD_MS } from "@/lib/auth/session-policy";

const RELOAD_KEY = "fintwin:resume-reload";

function recentlyReloaded() {
  const stamp = Number(sessionStorage.getItem(RELOAD_KEY) ?? "0");
  return Number.isFinite(stamp) && Date.now() - stamp < 15_000;
}

/**
 * Quando o separador volta do fundo (Safari suspende o JS e o stream RSC),
 * confirma a sessão. Se expirou, vai para o login. Se ainda é válida mas a
 * página esteve parada, recarrega para não ficar congelada.
 */
export function SessionResume() {
  useEffect(() => {
    let hiddenAt = 0;
    let checking = false;

    async function resume(force: boolean) {
      if (checking || isPublicAuthPath(window.location.pathname)) return;
      const away = hiddenAt > 0 ? Date.now() - hiddenAt : 0;
      if (!force && away < SESSION_RESUME_RELOAD_MS) return;
      checking = true;
      try {
        const response = await fetch("/api/session/status", {
          cache: "no-store",
          credentials: "same-origin",
          signal: AbortSignal.timeout(8_000),
        });
        if (response.status === 401) {
          window.location.replace("/login?expired=1");
          return;
        }
        if (!response.ok) return;
        if (recentlyReloaded()) return;
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
      } catch {
        if (!recentlyReloaded()) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          window.location.reload();
        }
      } finally {
        checking = false;
      }
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      void resume(false);
    }

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) void resume(true);
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return null;
}
