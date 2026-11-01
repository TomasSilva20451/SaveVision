"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MainNav } from "@/components/shell/main-nav";
import { WorkspaceSwitcher } from "@/components/shell/workspace-switcher";
import { appConfig } from "@/lib/config";

type WorkspaceOption = {
  id: string;
  name: string;
  type: "PERSONAL" | "JOINT";
};

type MobileNavProps = {
  unseenAlertsCount?: number;
  workspaces: WorkspaceOption[];
  activeWorkspaceId: string | null;
};

type ViewportBox = {
  top: number;
  height: number;
};

export function MobileNav({
  unseenAlertsCount = 0,
  workspaces,
  activeWorkspaceId,
}: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<ViewportBox | null>(null);

  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    const sync = () => {
      setBox({
        top: viewport?.offsetTop ?? 0,
        height: viewport?.height ?? window.innerHeight,
      });
    };
    sync();
    viewport?.addEventListener("resize", sync);
    viewport?.addEventListener("scroll", sync);
    return () => {
      viewport?.removeEventListener("resize", sync);
      viewport?.removeEventListener("scroll", sync);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const panelStyle = {
    top: box?.top ?? 0,
    height: box?.height ?? "100svh",
    maxHeight: box?.height ?? "100svh",
    backgroundColor: "#0b1220",
    backgroundImage: "linear-gradient(180deg, #081426 0%, #0b162a 55%, #11112f 100%)",
    color: "#e2e8f0",
  };

  const overlay =
    open && typeof document !== "undefined"
      ? createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[100] bg-slate-900/45"
              aria-label="Fechar menu"
              onClick={() => setOpen(false)}
            />
            <aside
              id="mobile-main-nav-root"
              className="mobile-nav-drawer-panel fixed left-0 z-[101] flex w-[min(20rem,86vw)] max-w-[86vw] flex-col text-[#e2e8f0] shadow-[12px_0_40px_rgb(15_23_42/0.35)]"
              style={panelStyle}
              role="dialog"
              aria-modal="true"
              aria-label={appConfig.name}
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="brand-mark grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold text-white">
                    <span className="brand-mark-dot" aria-hidden />
                    <span className="sr-only">{appConfig.name}</span>
                  </span>
                  <p className="truncate text-sm font-semibold tracking-tight text-slate-100">{appConfig.name}</p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-sm font-medium text-slate-100"
                  onClick={() => setOpen(false)}
                >
                  Fechar
                </button>
              </div>
              <div
                id="mobile-main-nav"
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-3"
              >
                <MainNav
                  className="mobile-nav-sidebar"
                  onNavigate={() => setOpen(false)}
                  unseenAlertsCount={unseenAlertsCount}
                />
              </div>
              <div className="shrink-0 border-t border-white/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Espaço</p>
                <WorkspaceSwitcher workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} />
              </div>
            </aside>
          </>,
          document.body,
        )
      : null;

  return (
    <div className="md:hidden">
      <button
        type="button"
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium dark:border-zinc-700"
        aria-expanded={open}
        aria-controls="mobile-main-nav"
        onClick={() => setOpen(true)}
      >
        Menu
      </button>
      {overlay}
    </div>
  );
}
