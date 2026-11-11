"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const VALUE_TRANSITION_MS = 200;
const previousValues = new Map<string, number>();

type ParsedValue = {
  numeric: number;
  kind: "currency" | "percent" | "number";
  fractionDigits: number;
};

function decimalPlaces(value: string) {
  const normalized = value.replace(/[\s\u00a0\u202f€%]/g, "");
  const separator = normalized.includes(",") ? "," : ".";
  const parts = normalized.split(separator);
  return parts.length > 1 ? Math.min(parts.at(-1)?.length ?? 0, 2) : 0;
}

export function parseAnimatedValue(value: string): ParsedValue | null {
  const trimmed = value.trim();
  const currency = trimmed.includes("€");
  const percent = trimmed.includes("%");
  let normalized = trimmed.replace(/[\s\u00a0\u202f€%]/g, "");

  if (!/^[+-]?[\d.,]+$/.test(normalized)) return null;
  if (normalized.includes(",")) {
    normalized = normalized.replaceAll(".", "").replace(",", ".");
  }

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return null;

  return {
    numeric,
    kind: currency ? "currency" : percent ? "percent" : "number",
    fractionDigits: decimalPlaces(trimmed),
  };
}

function formatFrame(value: number, parsed: ParsedValue) {
  const options: Intl.NumberFormatOptions = {
    minimumFractionDigits: parsed.fractionDigits,
    maximumFractionDigits: parsed.fractionDigits,
  };

  if (parsed.kind === "currency") {
    options.style = "currency";
    options.currency = "EUR";
  }

  const formatted = new Intl.NumberFormat("pt-PT", options).format(value);
  return parsed.kind === "percent" ? `${formatted}%` : formatted;
}

type AnimatedValueProps = {
  children: string;
  animationKey: string;
  className?: string;
};

/**
 * Anima apenas a apresentação. O valor financeiro canónico continua a ser
 * calculado no servidor com Decimal e o texto final permanece exatamente igual.
 */
export function AnimatedValue({ children, animationKey, className = "" }: AnimatedValueProps) {
  const pathname = usePathname();
  const elementRef = useRef<HTMLSpanElement>(null);
  const currentValueRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const scopedKey = `${pathname}:${animationKey}`;

  useLayoutEffect(() => {
    const element = elementRef.current;
    const parsed = parseAnimatedValue(children);

    if (!element || !parsed) return;

    const target = parsed.numeric;
    const previous = currentValueRef.current ?? previousValues.get(scopedKey);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (previous == null || previous === target || reducedMotion) {
      element.textContent = children;
      currentValueRef.current = target;
      previousValues.set(scopedKey, target);
      return;
    }

    if (frameRef.current != null) window.cancelAnimationFrame(frameRef.current);
    const startedAt = performance.now();
    element.dataset.changing = "true";
    element.textContent = formatFrame(previous, parsed);

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / VALUE_TRANSITION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = previous + (target - previous) * eased;
      element.textContent = progress === 1 ? children : formatFrame(value, parsed);
      currentValueRef.current = value;

      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(tick);
      } else {
        delete element.dataset.changing;
        currentValueRef.current = target;
        previousValues.set(scopedKey, target);
        frameRef.current = null;
      }
    };

    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current != null) window.cancelAnimationFrame(frameRef.current);
      previousValues.set(scopedKey, target);
    };
  }, [children, scopedKey]);

  return (
    <span
      ref={elementRef}
      className={`animated-financial-value ${className}`}
      aria-label={children}
    >
      {children}
    </span>
  );
}
