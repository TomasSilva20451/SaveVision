"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { formatEUR, roundMoney } from "@/lib/finance/money";
import { MOTION_FAST_MS, MOTION_HERO_MS } from "@/lib/ui/motion";
import { parseDisplayAmount } from "@/lib/ui/parse-display-amount";

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
}

type AnimatedMoneyProps = {
  value: string;
  className?: string;
  rawValue?: boolean;
  emphasis?: boolean;
  durationMs?: number;
};

function formatStatic(value: string, rawValue: boolean, amount: number) {
  if (rawValue && !value.includes("€")) return value;
  return formatEUR(amount);
}

function AnimatedMoneyMotion({
  value,
  className,
  rawValue = false,
  emphasis = false,
  durationMs = MOTION_FAST_MS,
}: AnimatedMoneyProps) {
  const target = parseDisplayAmount(value, rawValue);
  const [shown, setShown] = useState(() => roundMoney(target).toNumber());
  const fromRef = useRef(target);
  const previousValue = useRef<string>(value);

  useEffect(() => {
    if (previousValue.current === value) return;
    previousValue.current = value;

    const from = fromRef.current;
    const to = target;
    if (from === to) return;

    const ms = emphasis ? MOTION_HERO_MS : durationMs;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / ms);
      const eased = 1 - (1 - progress) ** 3;
      const next = from + (to - from) * eased;
      setShown(roundMoney(next).toNumber());
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        setShown(to);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, target, durationMs, emphasis]);

  return (
    <span className={className} data-animated-money>
      {formatStatic(value, rawValue, shown)}
    </span>
  );
}

export function AnimatedMoney(props: AnimatedMoneyProps) {
  const reducedMotion = usePrefersReducedMotion();
  const amount = parseDisplayAmount(props.value, props.rawValue ?? false);

  if (reducedMotion) {
    return (
      <span className={props.className} data-animated-money>
        {formatStatic(props.value, props.rawValue ?? false, amount)}
      </span>
    );
  }

  return <AnimatedMoneyMotion {...props} />;
}
