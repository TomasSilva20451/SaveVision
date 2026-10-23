"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { beginPasskeyRegistrationAction, finishPasskeyRegistrationAction } from "@/lib/auth/security-actions";
import { useSecurityStepUp } from "@/components/auth/security-step-up-context";
import { secondaryButtonClassName } from "@/components/ui/form-styles";

const WEBAUTHN_WAIT_MS = 120_000;

function webAuthnErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Registo cancelado. Podes tentar outra vez ou usar Safari/Chrome (não o browser do Cursor).";
    }
    if (error.name === "SecurityError") {
      return "WebAuthn bloqueado neste browser. Abre http://localhost:3000 no Safari ou Chrome.";
    }
    return error.message || error.name;
  }
  if (error instanceof Error) {
    if (error.message.includes("tempo")) return error.message;
    return error.message;
  }
  return "Não foi possível concluir o registo da passkey.";
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("Tempo esgotado à espera do Touch ID ou passkey. Carrega em Cancelar ou prime Esc e tenta no Safari."));
    }, ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function RegisterPasskeyButton() {
  const router = useRouter();
  const { requestStepUp } = useSecurityStepUp();
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const cancelledRef = useRef(false);

  function cancelWait() {
    cancelledRef.current = true;
    setPending(false);
    setMessage({
      type: "error",
      text: "Pedido cancelado na página. Se o macOS ainda mostrar «passkey» ou Touch ID, fecha com Esc ou Cancelar e tenta no Safari em localhost:3000.",
    });
  }

  async function runRegistration() {
    cancelledRef.current = false;
    setMessage(null);
    setPending(true);
    try {
      const started = await beginPasskeyRegistrationAction();
      if (cancelledRef.current) return;
      if (!started.ok) {
        setMessage({ type: "error", text: started.error });
        return;
      }
      const response = await withTimeout(startRegistration({ optionsJSON: started.options }), WEBAUTHN_WAIT_MS);
      if (cancelledRef.current) return;
      const result = await finishPasskeyRegistrationAction(response);
      if (!result.ok) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setMessage({ type: "success", text: "Passkey registada neste dispositivo." });
      router.refresh();
    } catch (error) {
      if (!cancelledRef.current) {
        setMessage({ type: "error", text: webAuthnErrorMessage(error) });
      }
    } finally {
      if (!cancelledRef.current) setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Usa Touch ID, Face ID ou chave de acesso do iCloud.{" "}
        <strong className="text-slate-800 dark:text-slate-200">Recomendado: Safari ou Chrome</strong> em{" "}
        <code className="text-xs">localhost:3000</code> — o browser integrado do Cursor costuma bloquear passkeys.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => requestStepUp(() => void runRegistration())}
          disabled={pending}
          className={secondaryButtonClassName}
        >
          {pending ? "A aguardar Touch ID / passkey…" : "Registar passkey neste dispositivo"}
        </button>
        {pending ? (
          <button type="button" onClick={cancelWait} className={secondaryButtonClassName}>
            Cancelar
          </button>
        ) : null}
      </div>
      {pending ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">O que fazer agora</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Procura um pop-up do <strong>macOS</strong> (Touch ID, iCloud Keychain ou «passkey») — pode estar atrás desta janela.</li>
            <li>Autoriza com impressão digital, Face ID ou «Continuar» / «Allow».</li>
            <li>Se não aparecer nada em ~30 s, prime <strong>Esc</strong>, carrega em <strong>Cancelar</strong> e abre a mesma página no <strong>Safari</strong>.</li>
          </ol>
        </div>
      ) : null}
      {message ? (
        <p className={`text-sm ${message.type === "error" ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
