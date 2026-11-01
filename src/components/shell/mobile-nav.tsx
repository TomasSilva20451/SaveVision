"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

const drawerStyle = {
  backgroundColor: "#0b1220",
  backgroundImage: "linear-gradient(180deg, #081426 0%, #0b162a 55%, #11112f 100%)",
  color: "#e2e8f0",
} as const;

export function MobileNav({
  unseenAlertsCount = 0,
  workspaces,
  activeWorkspaceId,
}: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const mounted = useIsClient();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    const dialog = dialogRef.current;
    const sync = () => {
      if (!dialog) return;
      const top = viewport?.offsetTop ?? 0;
      const height = viewport?.height ?? window.innerHeight;
      dialog.style.top = `${top}px`;
      dialog.style.height = `${height}px`;
      dialog.style.maxHeight = `${height}px`;
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
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const close = () => setOpen(false);

  const drawer = mounted
    ? createPortal(
        <dialog
          ref={dialogRef}
          className="mobile-nav-drawer"
          style={drawerStyle}
          aria-label={appConfig.name}
          onClose={close}
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          onClick={(event) => {
            if (event.target === dialogRef.current) close();
          }}
        >
          <div className="flex h-full min-h-0 flex-col" style={drawerStyle}>
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
                onClick={close}
              >
                Fechar
              </button>
            </div>
            <div id="mobile-main-nav" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-3">
              <MainNav className="mobile-nav-sidebar" onNavigate={close} unseenAlertsCount={unseenAlertsCount} />
            </div>
            <div className="shrink-0 border-t border-white/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Espaço</p>
              <WorkspaceSwitcher workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} />
            </div>
          </div>
        </dialog>,
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
      {drawer}
    </div>
  );
}
