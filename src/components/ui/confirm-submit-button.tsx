"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function ConfirmSubmitButton({
  children,
  confirmMessage,
  pendingLabel = "A processar…",
  className,
}: {
  children: ReactNode;
  confirmMessage: string;
  pendingLabel?: string;
  className: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-busy={pending}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
