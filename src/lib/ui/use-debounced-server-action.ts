"use client";

import { useCallback, useRef } from "react";

/**
 * Evita corridas quando o utilizador dispara a mesma server action várias vezes seguidas.
 * Em dev, o React Strict Mode pode montar efeitos duas vezes — isto não substitui idempotência no servidor.
 */
export function useDebouncedServerAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  debounceMs = 300,
) {
  const seqRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  return useCallback(
    (...args: TArgs): Promise<TResult> => {
      const seq = ++seqRef.current;
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      return new Promise((resolve, reject) => {
        timerRef.current = setTimeout(async () => {
          try {
            const result = await action(...args);
            if (seq === seqRef.current) resolve(result);
          } catch (error) {
            if (seq === seqRef.current) reject(error);
          }
        }, debounceMs);
      });
    },
    [action, debounceMs],
  );
}
