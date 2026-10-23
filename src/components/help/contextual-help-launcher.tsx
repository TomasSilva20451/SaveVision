"use client";

import { useState } from "react";
import { ContextualHelpDrawer } from "@/components/help/contextual-help-drawer";

export function ContextualHelpLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Abrir ajuda contextual"
        title="Ajuda contextual"
        className="contextual-help-fab fixed bottom-20 right-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-blue-600 text-lg font-bold text-white shadow-lg hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 md:bottom-8 md:right-8"
        onClick={() => {
          setOpen(true);
        }}
      >
        ?
      </button>
      {open ? <ContextualHelpDrawer onClose={() => setOpen(false)} /> : null}
    </>
  );
}
