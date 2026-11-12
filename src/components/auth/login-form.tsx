"use client";

import { useActionState, useEffect, useRef } from "react";
import { loginFlowAction, type LoginFlowState } from "@/lib/auth/actions";
import { LoginBrand } from "@/components/auth/login-brand";
import { LoginMfaStep } from "@/components/auth/login-mfa-step";

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
      <LoginMfaStep
        key={state.challengeToken}
        state={state}
        action={action}
        pending={pending}
        deviceIdRef={deviceIdRef}
      />
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
