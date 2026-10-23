"use client";

import { useState } from "react";
import { MainNav } from "@/components/shell/main-nav";
import { appConfig } from "@/lib/config";

type MobileNavProps = {
  unseenAlertsCount?: number;
};

export function MobileNav({ unseenAlertsCount = 0 }: MobileNavProps) {
  const [open, setOpen] = useState(false);

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
        <div
          id="mobile-main-nav"
          className="absolute left-0 right-0 top-14 z-40 max-h-[80vh] overflow-y-auto bg-[var(--sidebar)] p-4 text-slate-100 shadow-xl"
        >
          <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {appConfig.name}
          </p>
          <MainNav onNavigate={() => setOpen(false)} unseenAlertsCount={unseenAlertsCount} />
        </div>
      ) : null}
    </div>
  );
}
