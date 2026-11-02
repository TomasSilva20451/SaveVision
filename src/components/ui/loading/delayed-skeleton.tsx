"use client";

import { type ReactNode, useEffect, useState } from "react";

import { SKELETON_DELAY_MS } from "@/lib/ui/loading-policy";

type DelayedSkeletonProps = {
  children: ReactNode;
  delayMs?: number;
};

/** Evita skeleton em respostas rápidas abaixo de {@link SKELETON_DELAY_MS} ms. */
export function DelayedSkeleton({ children, delayMs = SKELETON_DELAY_MS }: DelayedSkeletonProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  if (!visible) return null;
  return children;
}
