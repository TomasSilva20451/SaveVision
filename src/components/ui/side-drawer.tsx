"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";

type SideDrawerProps = {
  open: boolean;
  onClose: () => void;
  titleId: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
};

export function SideDrawer({ open, onClose, titleId, returnFocusRef, children }: SideDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      role="dialog"
      className="side-drawer"
      aria-modal="true"
      aria-labelledby={titleId}
      onClose={() => {
        onClose();
        returnFocusRef?.current?.focus();
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="flex h-full min-h-0 flex-col">{children}</div>
    </dialog>
  );
}
