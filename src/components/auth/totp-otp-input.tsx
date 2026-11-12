"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

const DIGITS = 6;

export type TotpOtpVisualStatus = "idle" | "verifying" | "success" | "error";

type TotpOtpInputProps = {
  name?: string;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  status?: TotpOtpVisualStatus;
  onValueChange?: (value: string) => void;
  /** Chamado no mesmo evento em que o sexto dígito fica completo (sem depender de useEffect). */
  onComplete?: (digits: string) => void;
};

export function TotpOtpInput({
  name = "totp",
  id,
  disabled,
  invalid,
  status = "idle",
  onValueChange,
  onComplete,
}: TotpOtpInputProps) {
  const reactId = useId();
  const inputId = id ?? `totp-${reactId}`;
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const shakeKey = invalid || status === "error" ? "error" : "idle";

  const cells = useMemo(() => Array.from({ length: DIGITS }, (_, index) => value[index] ?? ""), [value]);

  const sync = useCallback(
    (next: string) => {
      const digits = next.replace(/\D/g, "").slice(0, DIGITS);
      setValue(digits);
      onValueChange?.(digits);
      if (digits.length === DIGITS) {
        onComplete?.(digits);
      }
    },
    [onComplete, onValueChange],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, [shakeKey]);

  function focusInput() {
    if (!disabled) inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && value.length > 0 && inputRef.current?.selectionStart === 0) {
      event.preventDefault();
      sync(value.slice(0, -1));
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text/plain") || event.clipboardData.getData("text");
    const digits = text.replace(/\D/g, "");
    if (digits.length === 0) {
      return;
    }
    event.preventDefault();
    sync(text);
  }

  const activeIndex = Math.min(value.length, DIGITS - 1);

  const rootClass = [
    "login-totp-root",
    status === "verifying" ? "login-totp-root--verifying" : "",
    status === "success" ? "login-totp-root--success" : "",
    status === "error" || invalid ? "login-totp-root--error" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={rootClass}
      data-shake={shakeKey === "error" ? "1" : undefined}
      onPointerDown={focusInput}
    >
      <label htmlFor={inputId} className="sr-only">
        Código de autenticação de seis dígitos
      </label>
      <div className="login-totp-cells" role="presentation" aria-hidden="true">
        {cells.map((char, index) => (
          <span
            key={index}
            data-active={index === activeIndex && !disabled ? "true" : undefined}
            data-filled={char ? "true" : undefined}
            className="login-totp-cell"
          >
            {char || "\u00a0"}
          </span>
        ))}
      </div>
      <input
        ref={inputRef}
        id={inputId}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        pattern="[0-9]*"
        disabled={disabled}
        value={value}
        onChange={(event) => sync(event.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${inputId}-error` : undefined}
        className="login-totp-accessible-input"
        data-testid="login-totp-input"
      />
    </div>
  );
}
