"use client";

import { useEffect, useRef, useState } from "react";
import { MainNav } from "@/components/shell/main-nav";
import { appConfig } from "@/lib/config";

type MobileNavProps = {
  unseenAlertsCount?: number;
};

type ViewportBox = {
  top: number;
  height: number;
};

export function MobileNav({ unseenAlertsCount = 0 }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<ViewportBox | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

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
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

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
      <dialog
        ref={dialogRef}
        className="mobile-nav-drawer"
        aria-label={appConfig.name}
        style={box ? { top: box.top, height: box.height, maxHeight: box.height } : undefined}
        onClose={() => setOpen(false)}
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(false);
        }}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{appConfig.name}</p>
            <button
              type="button"
              className="rounded-lg border border-white/15 px-3 py-1.5 text-sm font-medium text-slate-100"
              onClick={() => setOpen(false)}
            >
              Fechar
            </button>
          </div>
          <div
            id="mobile-main-nav"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)]"
          >
            <MainNav onNavigate={() => setOpen(false)} unseenAlertsCount={unseenAlertsCount} />
          </div>
        </div>
      </dialog>
    </div>
  );
}
