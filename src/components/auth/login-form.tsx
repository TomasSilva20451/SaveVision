"use client";

import { useActionState, useEffect, useRef } from "react";
import { loginFlowAction, type LoginFlowState } from "@/lib/auth/actions";
import { LoginBrand } from "@/components/auth/login-brand";
import { TotpOtpInput } from "@/components/auth/totp-otp-input";
import { LoginPasskeyMfaButton } from "@/components/auth/login-passkey-mfa-button";

const initialState: LoginFlowState = {
  step: "credentials",
  error: null,
  fieldErrors: {},
};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginFlowAction, initialState);
  const deviceIdRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const key = "fintwin_device_id";
    const existing = window.localStorage.getItem(key);
    const value = existing && existing.length > 8 ? existing : crypto.randomUUID();
    window.localStorage.setItem(key, value);
    if (deviceIdRef.current) deviceIdRef.current.value = value;
  }, []);

  useEffect(() => {
    if (deviceIdRef.current && state.step === "mfa") {
      deviceIdRef.current.disabled = false;
    }
  }, [state]);

  if (state.step === "mfa") {
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

        <form action={action} className="login-form" noValidate>
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
            <TotpOtpInput invalid={Boolean(state.mfaError)} />
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

          <button type="submit" disabled={pending} className="login-primary-button">
            {pending ? "A verificar identidade…" : "Verificar identidade"}
          </button>
        </form>

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
      </div>
    );
  }

  return (
    <div className="login-card" data-testid="login-credentials-step">
      <LoginBrand />
      <h1 className="login-title">Bem-vindo de volta</h1>
      <form action={action} className="login-form" noValidate>
        <input ref={deviceIdRef} type="hidden" name="deviceId" defaultValue="" />
        <input type="hidden" name="intent" value="credentials" />
        <div className="login-field">
          <label htmlFor="email" className="login-label">
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="username" required className="login-input" />
          {state.fieldErrors.email ? <p className="login-field-error">{state.fieldErrors.email}</p> : null}
        </div>
        <div className="login-field">
          <label htmlFor="password" className="login-label">
            Palavra-passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="login-input"
          />
          {state.fieldErrors.password ? <p className="login-field-error">{state.fieldErrors.password}</p> : null}
        </div>
        {state.error ? (
          <p role="alert" className="login-alert login-alert-error" data-testid="login-credentials-error">
            {state.error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className="login-primary-button">
          {pending ? "A verificar…" : "Continuar"}
        </button>
        <a href="/recuperar-conta" className="login-text-link">
          Recuperar conta
        </a>
      </form>
    </div>
  );
}
