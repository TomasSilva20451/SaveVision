"use client";

import { useState } from "react";
import { MainNav } from "@/components/shell/main-nav";
import { appConfig } from "@/lib/config";

export function MobileNav() {
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
          className="absolute left-0 right-0 top-[52px] z-40 max-h-[70vh] overflow-y-auto border-b border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
        >
          <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {appConfig.name}
          </p>
          <MainNav onNavigate={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
