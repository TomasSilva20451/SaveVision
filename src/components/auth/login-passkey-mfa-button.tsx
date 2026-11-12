"use client";

import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { startLoginPasskeyMfaAction } from "@/lib/auth/security-actions";

type Props = {
  email: string;
  challengeToken: string;
};

export function LoginPasskeyMfaButton({ email, challengeToken }: Props) {
  const [error, setError] = useState<string | null>(null);

  async function handlePasskey() {
    setError(null);
    const started = await startLoginPasskeyMfaAction(email, challengeToken);
    if (!started.ok) {
      setError(started.error);
      return;
    }
    const assertion = await startAuthentication({ optionsJSON: started.options });
    const hidden = document.querySelector("#passkey-assertion") as HTMLInputElement | null;
    const form = hidden?.closest("form");
    if (hidden) hidden.value = JSON.stringify(assertion);
    form?.requestSubmit();
  }

  return (
    <div className="login-passkey-row">
      <button type="button" onClick={() => void handlePasskey()} className="login-secondary-button">
        Verificar com passkey
      </button>
      {error ? <p className="login-field-error">{error}</p> : null}
    </div>
  );
}
