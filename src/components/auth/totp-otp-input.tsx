"use client";

import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

const DIGITS = 6;

type TotpOtpInputProps = {
  name?: string;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  onValueChange?: (value: string) => void;
};

export function TotpOtpInput({ name = "totp", id, disabled, invalid, onValueChange }: TotpOtpInputProps) {
  const reactId = useId();
  const inputId = id ?? `totp-${reactId}`;
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const cells = useMemo(() => Array.from({ length: DIGITS }, (_, index) => value[index] ?? ""), [value]);

  const sync = useCallback(
    (next: string) => {
      const digits = next.replace(/\D/g, "").slice(0, DIGITS);
      setValue(digits);
      onValueChange?.(digits);
    },
    [onValueChange],
  );

  function focusInput() {
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && value.length > 0 && inputRef.current?.selectionStart === 0) {
      event.preventDefault();
      sync(value.slice(0, -1));
    }
  }

  const activeIndex = Math.min(value.length, DIGITS - 1);

  return (
    <div className="login-totp-root">
      <label htmlFor={inputId} className="sr-only">
        Código de autenticação de seis dígitos
      </label>
      <input
        ref={inputRef}
        id={inputId}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={DIGITS}
        disabled={disabled}
        value={value}
        onChange={(event) => sync(event.target.value)}
        onKeyDown={onKeyDown}
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData("text");
          sync(text);
        }}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${inputId}-error` : undefined}
        className="login-totp-accessible-input"
      />
      <div className="login-totp-cells" role="group" aria-hidden="true" onClick={focusInput}>
        {cells.map((char, index) => (
          <span
            key={index}
            data-active={index === activeIndex && !disabled ? "true" : undefined}
            className="login-totp-cell"
          >
            {char || "\u00a0"}
          </span>
        ))}
      </div>
    </div>
  );
}
