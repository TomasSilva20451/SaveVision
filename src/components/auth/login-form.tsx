"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { loginAction, type LoginState } from "@/lib/auth/actions";
import { startLoginPasskeyAction } from "@/lib/auth/security-actions";

const initialState: LoginState = { error: null, mfaRequired: null, fieldErrors: {} };

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);
  const deviceIdRef = useRef<HTMLInputElement>(null);
  const totpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const key = "fintwin_device_id";
    const existing = window.localStorage.getItem(key);
    const value = existing && existing.length > 8 ? existing : crypto.randomUUID();
    window.localStorage.setItem(key, value);
    if (deviceIdRef.current) deviceIdRef.current.value = value;
  }, []);

  useEffect(() => {
    if (state.mfaRequired && totpRef.current) {
      totpRef.current.focus();
    }
  }, [state.mfaRequired]);

  const mfaHighlight = Boolean(state.mfaRequired);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input ref={deviceIdRef} type="hidden" name="deviceId" defaultValue="" />
      <input type="hidden" name="passkey" id="passkey-assertion" />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-visible:outline-zinc-100"
        />
        {state.fieldErrors.email ? <p className="text-sm text-red-700 dark:text-red-400">{state.fieldErrors.email}</p> : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">Palavra-passe</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-visible:outline-zinc-100"
        />
        {state.fieldErrors.password ? <p className="text-sm text-red-700 dark:text-red-400">{state.fieldErrors.password}</p> : null}
      </div>

      <div
        className={`flex flex-col gap-3 rounded-lg border p-3 ${mfaHighlight ? "border-amber-300 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/30" : "border-zinc-200 dark:border-zinc-800"}`}
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {mfaHighlight
            ? "Falta o segundo factor. Mantém email e palavra-passe e preenche o código abaixo — um só «Entrar»."
            : "Conta com MFA? Preenche o código TOTP (ou recuperação) aqui e entra de uma vez."}
        </p>
        <label className="flex flex-col gap-1 text-sm" htmlFor="totp">
          Código TOTP (opcional se não tiveres MFA)
          <input
            ref={totpRef}
            id="totp"
            name="totp"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm" htmlFor="recoveryCode">
          Ou código de recuperação
          <input
            id="recoveryCode"
            name="recoveryCode"
            autoComplete="off"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        {(state.mfaRequired === "passkey" || state.mfaRequired === "either") ? <PasskeyLoginButton /> : null}
      </div>

      {state.error ? <p role="alert" className="text-sm text-red-700 dark:text-red-400">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "A entrar…" : "Entrar"}
      </button>
      <a href="/recuperar-conta" className="text-sm text-zinc-600 underline dark:text-zinc-400">
        Recuperar conta
      </a>
    </form>
  );
}

function PasskeyLoginButton() {
  const [error, setError] = useState<string | null>(null);

  async function handlePasskeyLogin() {
    const form = document.querySelector("form");
    const email = (form?.querySelector("#email") as HTMLInputElement | null)?.value ?? "";
    const password = (form?.querySelector("#password") as HTMLInputElement | null)?.value ?? "";
    const started = await startLoginPasskeyAction(email, password);
    if (!started.ok) {
      setError(started.error);
      return;
    }
    const assertion = await startAuthentication({ optionsJSON: started.options });
    const hidden = document.querySelector("#passkey-assertion") as HTMLInputElement | null;
    if (hidden) hidden.value = JSON.stringify(assertion);
    form?.requestSubmit();
  }

  return (
    <div>
      <button type="button" onClick={() => void handlePasskeyLogin()} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">
        Entrar com passkey (em vez de TOTP)
      </button>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
