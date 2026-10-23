"use client";

import { useEffect } from "react";
import { clearFlashAction } from "@/lib/ui/clear-flash";

type FlashBannerProps = {
  type: "success" | "error" | "info";
  message: string;
};

const styles: Record<FlashBannerProps["type"], string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100",
  error:
    "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100",
  info: "border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
};

export function FlashBanner({ type, message }: FlashBannerProps) {
  useEffect(() => {
    void clearFlashAction();
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mb-4 rounded-lg border px-4 py-3 text-sm ${styles[type]}`}
    >
      {message}
    </div>
  );
}
