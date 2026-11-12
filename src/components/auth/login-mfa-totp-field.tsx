"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch } from "react";
import { buildLoginMfaFormData } from "@/lib/auth/login-mfa-form";
import { deriveTotpVisualStatus } from "@/lib/auth/totp-visual-status";
import { isMfaTotpInvalidMessage } from "@/lib/auth/totp-messages";
import { canSubmitTotpManually, shouldAutoSubmitTotp } from "@/lib/auth/totp-auto-submit";
import { TotpOtpInput } from "@/components/auth/totp-otp-input";

type LoginMfaTotpFieldProps = {
  formRef: React.RefObject<HTMLFormElement | null>;
  action: Dispatch<FormData>;
  pending: boolean;
  mfaError: string | null;
  onDigitsChange: (digits: string) => void;
};

export function LoginMfaTotpField({
  formRef,
  action,
  pending,
  mfaError,
  onDigitsChange,
}: LoginMfaTotpFieldProps) {
  const [totpDigits, setTotpDigits] = useState("");
  const lastAutoSubmittedRef = useRef<string | null>(null);
  const verifyInFlightRef = useRef(false);

  const visualStatus = deriveTotpVisualStatus(pending, mfaError, totpDigits.length);
  const manualEnabled = canSubmitTotpManually(totpDigits, pending);

  useEffect(() => {
    if (!pending) {
      verifyInFlightRef.current = false;
    }
  }, [pending]);

  const verifyTotp = useCallback(
    (code: string, mode: "auto" | "manual") => {
      if (pending || verifyInFlightRef.current) return;
      const form = formRef.current;
      if (!form) return;

      const normalized = code.replace(/\D/g, "").slice(0, 6);
      if (normalized.length !== 6) return;

      if (mode === "auto" && !shouldAutoSubmitTotp(normalized, lastAutoSubmittedRef.current)) {
        return;
      }

      lastAutoSubmittedRef.current = normalized;
      verifyInFlightRef.current = true;
      action(buildLoginMfaFormData(form, normalized));
    },
    [action, formRef, pending],
  );

  const handleValueChange = useCallback(
    (digits: string) => {
      setTotpDigits(digits);
      onDigitsChange(digits);
    },
    [onDigitsChange],
  );

  const handleComplete = useCallback(
    (code: string) => {
      verifyTotp(code, "auto");
    },
    [verifyTotp],
  );

  return (
    <div className="login-totp-block" data-pending={pending ? "true" : undefined}>
      <TotpOtpInput
        disabled={pending}
        status={visualStatus}
        invalid={isMfaTotpInvalidMessage(mfaError)}
        onValueChange={handleValueChange}
        onComplete={handleComplete}
      />
      <TotpOtpHint visualStatus={visualStatus} pending={pending} />
      <span className="sr-only" data-testid="login-mfa-manual-enabled">
        {manualEnabled ? "true" : "false"}
      </span>
    </div>
  );
}

function TotpOtpHint({
  visualStatus,
  pending,
}: {
  visualStatus: ReturnType<typeof deriveTotpVisualStatus>;
  pending: boolean;
}) {
  if (visualStatus === "verifying" || pending) {
    return (
      <p className="login-totp-hint" aria-live="polite" data-testid="login-totp-verifying">
        <span className="login-totp-spinner" aria-hidden />
        A verificar código…
      </p>
    );
  }
  if (visualStatus === "success") {
    return (
      <p className="login-totp-hint login-totp-hint-success" aria-live="polite" data-testid="login-totp-success">
        <span className="login-totp-success-icon" aria-hidden />
        Código aceite
      </p>
    );
  }
  return null;
}
