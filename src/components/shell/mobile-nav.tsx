"use client";

import { useEffect, useState } from "react";
import { MainNav } from "@/components/shell/main-nav";
import { appConfig } from "@/lib/config";

type MobileNavProps = {
  unseenAlertsCount?: number;
};

export function MobileNav({ unseenAlertsCount = 0 }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", close, { capture: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium dark:border-zinc-700"
        aria-expanded={open}
        aria-controls="mobile-main-nav"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Fechar menu" : "Menu"}
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-900/45 md:hidden"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
          />
          <div
            id="mobile-main-nav"
            className="fixed left-0 right-0 top-14 z-50 max-h-[calc(100dvh-3.5rem)] overflow-y-auto bg-[var(--sidebar)] p-4 text-slate-100 shadow-xl md:hidden"
          >
            <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {appConfig.name}
            </p>
            <MainNav onNavigate={() => setOpen(false)} unseenAlertsCount={unseenAlertsCount} />
          </div>
        </>
      ) : null}
    </div>
  );
}
