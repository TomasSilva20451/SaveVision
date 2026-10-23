"use client";

import { useActionState } from "react";
import QRCode from "react-qr-code";
import {
  beginTotpFormAction,
  confirmTotpFormAction,
  disableTotpAction,
  regenerateRecoveryCodesAction,
  type TotpBeginState,
  type TotpConfirmState,
} from "@/lib/auth/security-actions";
import { StepUpGatedForm, useSecurityStepUp } from "@/components/auth/security-step-up-context";
import { inputClassName, primaryButtonClassName, secondaryButtonClassName } from "@/components/ui/form-styles";

const beginInitial: TotpBeginState = { error: null, secret: null, uri: null };
const confirmInitial: TotpConfirmState = { error: null, recoveryCodes: null };

type MfaTotpPanelProps = {
  totpActive: boolean;
  recoveryLeft: number;
};

export function MfaTotpPanel({ totpActive, recoveryLeft }: MfaTotpPanelProps) {
  const { stepUpActive, requestStepUp } = useSecurityStepUp();
  const [beginState, beginAction, beginPending] = useActionState(beginTotpFormAction, beginInitial);
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmTotpFormAction, confirmInitial);

  return (
    <div className="space-y-4">
      <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-400">
        <li>
          Carrega em <strong>Gerar segredo</strong>. Se a confirmação reforçada não estiver activa, abre-se um pop-up para palavra-passe
          {stepUpActive ? " (já confirmaste)." : "."}
        </li>
        <li>Lê o <strong>QR code</strong> com a app autenticadora (Google Authenticator, 1Password, Bitwarden, etc.).</li>
        <li>Introduz o código de 6 dígitos e carrega em <strong>Activar</strong>. Guarda os códigos de recuperação que aparecem.</li>
      </ol>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={secondaryButtonClassName}
          disabled={beginPending || totpActive}
          onClick={() => requestStepUp(() => beginAction())}
        >
          {beginPending ? "A gerar…" : "Gerar segredo"}
        </button>
        <StepUpGatedForm action={disableTotpAction}>
          <button className={secondaryButtonClassName} type="submit" disabled={!totpActive}>
            Desactivar
          </button>
        </StepUpGatedForm>
        <StepUpGatedForm action={regenerateRecoveryCodesAction}>
          <button className={secondaryButtonClassName} type="submit" disabled={!totpActive} title={totpActive ? undefined : "Activa o TOTP primeiro"}>
            Novos códigos de recuperação
          </button>
        </StepUpGatedForm>
      </div>

      {beginState.error ? <p className="text-sm text-red-700 dark:text-red-400">{beginState.error}</p> : null}
      {beginState.uri ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-900 dark:bg-blue-950/40">
          <p className="font-medium text-blue-900 dark:text-blue-100">QR code para a app autenticadora</p>
          <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <div className="rounded-lg bg-white p-3 shadow-sm">
              <QRCode value={beginState.uri} size={192} level="M" aria-label="QR code TOTP" />
            </div>
            <div className="max-w-sm space-y-2 text-blue-800 dark:text-blue-200">
              <p>Na app: <strong>Escanear QR code</strong> / <strong>Adicionar conta</strong>.</p>
              <p className="text-xs">Se não conseguires ler o QR, usa a chave manual abaixo.</p>
            </div>
          </div>
          {beginState.secret ? (
            <details className="mt-4">
              <summary className="cursor-pointer font-medium text-blue-900 dark:text-blue-100">Chave manual (alternativa)</summary>
              <p className="mt-2 font-mono text-xs break-all select-all">{beginState.secret}</p>
            </details>
          ) : null}
        </div>
      ) : null}

      {!totpActive ? (
        <StepUpGatedForm action={confirmAction} className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
            Código da app
            <input name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className={inputClassName} required />
          </label>
          <button className={primaryButtonClassName} type="submit" disabled={confirmPending}>
            {confirmPending ? "A activar…" : "Activar"}
          </button>
        </StepUpGatedForm>
      ) : (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">TOTP activo. Códigos de recuperação por usar: {recoveryLeft}.</p>
      )}

      {confirmState.error ? <p className="text-sm text-red-700 dark:text-red-400">{confirmState.error}</p> : null}
      {confirmState.recoveryCodes ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <p className="font-semibold text-amber-900 dark:text-amber-100">Guarda estes códigos de recuperação (uso único)</p>
          <ul className="mt-2 grid gap-1 font-mono text-xs sm:grid-cols-2">
            {confirmState.recoveryCodes.map((code) => (
              <li key={code} className="select-all">{code}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
