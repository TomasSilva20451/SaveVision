"use client";

import { useEffect, useRef, useState } from "react";
import { deriveTotpVisualStatus } from "@/lib/auth/totp-visual-status";
import { isMfaTotpInvalidMessage } from "@/lib/auth/totp-messages";
import { canSubmitTotpManually, shouldAutoSubmitTotp } from "@/lib/auth/totp-auto-submit";
import { TotpOtpInput } from "@/components/auth/totp-otp-input";

type LoginMfaTotpFieldProps = {
  formRef: React.RefObject<HTMLFormElement | null>;
  pending: boolean;
  mfaError: string | null;
  onDigitsChange: (digits: string) => void;
};

export function LoginMfaTotpField({
  formRef,
  pending,
  mfaError,
  onDigitsChange,
}: LoginMfaTotpFieldProps) {
  const [totpDigits, setTotpDigits] = useState("");
  const lastAutoSubmittedRef = useRef<string | null>(null);

  const visualStatus = deriveTotpVisualStatus(pending, mfaError, totpDigits.length);
  const manualEnabled = canSubmitTotpManually(totpDigits, pending);

  useEffect(() => {
    onDigitsChange(totpDigits);
  }, [onDigitsChange, totpDigits]);

  useEffect(() => {
    if (!shouldAutoSubmitTotp(totpDigits, lastAutoSubmittedRef.current)) return;
    if (pending) return;
    const form = formRef.current;
    if (!form) return;
    lastAutoSubmittedRef.current = totpDigits;
    form.requestSubmit();
  }, [formRef, pending, totpDigits]);

  return (
    <div className="login-totp-block" data-pending={pending ? "true" : undefined}>
      <TotpOtpInput
        disabled={pending}
        status={visualStatus}
        invalid={isMfaTotpInvalidMessage(mfaError)}
        onValueChange={setTotpDigits}
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
