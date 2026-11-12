"use client";

import { useRef, useState, type Dispatch } from "react";
import type { LoginFlowState } from "@/lib/auth/actions";
import { canSubmitTotpManually } from "@/lib/auth/totp-auto-submit";
import { LoginPasskeyMfaButton } from "@/components/auth/login-passkey-mfa-button";
import { LoginMfaTotpField } from "@/components/auth/login-mfa-totp-field";

type MfaState = Extract<LoginFlowState, { step: "mfa" }>;

type LoginMfaStepProps = {
  state: MfaState;
  action: Dispatch<FormData>;
  pending: boolean;
  deviceIdRef: React.RefObject<HTMLInputElement | null>;
};

export function LoginMfaStep({ state, action, pending, deviceIdRef }: LoginMfaStepProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [totpDigits, setTotpDigits] = useState("");
  const manualEnabled = canSubmitTotpManually(totpDigits, pending) || state.recoveryMode;

  return (
    <div className="login-card login-card-mfa" data-testid="login-mfa-step">
      <div className="login-shield-icon" aria-hidden>
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
          <path d="M12 2 4 5v6c0 5.25 3.4 10.15 8 11.35C16.6 21.15 20 16.25 20 11V5l-8-3Zm0 2.2 6 2.25V11c0 4.1-2.65 7.95-6 9.05-3.35-1.1-6-4.95-6-9.05V6.45l6-2.25ZM11 8v5.5l3.2 1.9-.8 1.3L10 14.5V8h1Z" />
        </svg>
      </div>
      <h1 className="login-title">Verificação de segurança</h1>
      <p className="login-subtitle">
        {state.recoveryMode
          ? "Introduz um código de recuperação de utilização única."
          : "Abre a tua aplicação de autenticação e introduz o código de 6 dígitos."}
      </p>

      <form ref={formRef} action={action} className="login-form" noValidate>
        <input ref={deviceIdRef} type="hidden" name="deviceId" defaultValue="" />
        <input type="hidden" name="intent" value="mfa" />
        <input type="hidden" name="email" value={state.email} />
        <input type="hidden" name="mfaChallengeToken" value={state.challengeToken} />
        <input type="hidden" name="recoveryMode" value={state.recoveryMode ? "1" : "0"} />
        <input type="hidden" name="passkey" id="passkey-assertion" />

        {state.recoveryMode ? (
          <div className="login-field" data-testid="login-recovery-field">
            <label htmlFor="recoveryCode" className="login-label">
              Código de recuperação
            </label>
            <input
              id="recoveryCode"
              name="recoveryCode"
              autoComplete="off"
              required
              className="login-input font-mono"
            />
          </div>
        ) : (
          <LoginMfaTotpField
            key={`${state.challengeToken}-${state.totpResetNonce}`}
            formRef={formRef}
            pending={pending}
            mfaError={state.mfaError}
            onDigitsChange={setTotpDigits}
          />
        )}

        {(state.mfaKind === "passkey" || state.mfaKind === "either") && !state.recoveryMode ? (
          <LoginPasskeyMfaButton email={state.email} challengeToken={state.challengeToken} />
        ) : null}

        {state.error ? (
          <p role="alert" className="login-alert login-alert-error">
            {state.error}
          </p>
        ) : null}
        {state.mfaError ? (
          <p role="alert" className="login-alert login-alert-error" data-testid="login-mfa-error">
            {state.mfaError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={state.recoveryMode ? pending : !manualEnabled}
          className="login-primary-button"
          data-testid="login-mfa-submit"
        >
          {pending ? "A verificar identidade…" : "Verificar identidade"}
        </button>
      </form>

      <TrackingLinks state={state} action={action} />
    </div>
  );
}

function TrackingLinks({
  state,
  action,
}: {
  state: MfaState;
  action: Dispatch<FormData>;
}) {
  return (
    <div className="login-mfa-links">
      {!state.recoveryMode ? (
        <form action={action}>
          <input type="hidden" name="intent" value="toggle-recovery" />
          <input type="hidden" name="recoveryMode" value="1" />
          <input type="hidden" name="email" value={state.email} />
          <input type="hidden" name="mfaChallengeToken" value={state.challengeToken} />
          <button type="submit" className="login-text-link">
            Utilizar código de recuperação
          </button>
        </form>
      ) : (
        <form action={action}>
          <input type="hidden" name="intent" value="toggle-recovery" />
          <input type="hidden" name="recoveryMode" value="0" />
          <input type="hidden" name="email" value={state.email} />
          <input type="hidden" name="mfaChallengeToken" value={state.challengeToken} />
          <button type="submit" className="login-text-link">
            Voltar ao código TOTP
          </button>
        </form>
      )}
      <form action={action}>
        <input type="hidden" name="intent" value="cancel-mfa" />
        <input type="hidden" name="mfaChallengeToken" value={state.challengeToken} />
        <button type="submit" className="login-text-link" data-testid="login-back">
          Voltar ao login
        </button>
      </form>
    </div>
  );
}
