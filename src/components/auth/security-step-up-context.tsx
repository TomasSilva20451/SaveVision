"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useActionState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { confirmStepUpFormAction, type StepUpConfirmState } from "@/lib/auth/security-actions";
import { inputClassName, labelClassName, primaryButtonClassName, secondaryButtonClassName } from "@/components/ui/form-styles";

type SecurityStepUpContextValue = {
  stepUpActive: boolean;
  requestStepUp: (then?: () => void) => void;
};

const SecurityStepUpContext = createContext<SecurityStepUpContextValue | null>(null);

export function useSecurityStepUp() {
  const ctx = useContext(SecurityStepUpContext);
  if (!ctx) throw new Error("useSecurityStepUp tem de estar dentro de SecurityStepUpProvider");
  return ctx;
}

type ProviderProps = {
  children: ReactNode;
  initialStepUpActive: boolean;
  totpEnabled: boolean;
};

export function SecurityStepUpProvider({ children, initialStepUpActive, totpEnabled }: ProviderProps) {
  const router = useRouter();
  const [stepUpActive, setStepUpActive] = useState(initialStepUpActive);
  const [open, setOpen] = useState(false);
  const afterConfirmRef = useRef<(() => void) | null>(null);

  const effectiveStepUpActive = stepUpActive || initialStepUpActive;

  const requestStepUp = useCallback(
    (then?: () => void) => {
      if (effectiveStepUpActive) {
        then?.();
        return;
      }
      afterConfirmRef.current = then ?? null;
      setOpen(true);
    },
    [effectiveStepUpActive],
  );

  function handleConfirmed() {
    setStepUpActive(true);
    setOpen(false);
    router.refresh();
    const next = afterConfirmRef.current;
    afterConfirmRef.current = null;
    next?.();
  }

  return (
    <SecurityStepUpContext.Provider value={{ stepUpActive: effectiveStepUpActive, requestStepUp }}>
      {children}
      {open ? (
        <StepUpModal
          totpEnabled={totpEnabled}
          onClose={() => {
            setOpen(false);
            afterConfirmRef.current = null;
          }}
          onConfirmed={handleConfirmed}
        />
      ) : null}
    </SecurityStepUpContext.Provider>
  );
}

function StepUpModal({
  totpEnabled,
  onClose,
  onConfirmed,
}: {
  totpEnabled: boolean;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const initial: StepUpConfirmState = { error: null, ok: false };
  const [state, action, pending] = useActionState(confirmStepUpFormAction, initial);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (state.ok) onConfirmed();
  }, [state.ok, onConfirmed]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="step-up-title"
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="step-up-title" className="text-lg font-semibold">
          Confirmar identidade
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Obrigatório para esta alteração. Fica válido durante 10 minutos (inclui entrada recente com TOTP).
        </p>
        <form action={action} className="mt-4 grid gap-3">
          <label className={labelClassName}>
            Palavra-passe
            <input name="password" type="password" required autoComplete="current-password" className={inputClassName} />
          </label>
          {totpEnabled ? (
            <label className={labelClassName}>
              Código TOTP
              <input name="totp" inputMode="numeric" autoComplete="one-time-code" required className={inputClassName} />
            </label>
          ) : null}
          {state.error ? <p className="text-sm text-red-700 dark:text-red-400">{state.error}</p> : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="submit" className={primaryButtonClassName} disabled={pending}>
              {pending ? "A confirmar…" : "Confirmar"}
            </button>
            <button type="button" className={secondaryButtonClassName} onClick={onClose}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Envia o formulário só depois da confirmação reforçada, se necessário. */
export function StepUpGatedForm({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: string | ((formData: FormData) => void | Promise<void>);
  className?: string;
}) {
  const { stepUpActive, requestStepUp } = useSecurityStepUp();
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (stepUpActive) return;
    event.preventDefault();
    requestStepUp(() => formRef.current?.requestSubmit());
  }

  return (
    <form ref={formRef} action={action} className={className} onSubmit={onSubmit}>
      {children}
    </form>
  );
}

async function downloadAccountExport() {
  const response = await fetch("/api/account/export");
  if (!response.ok) throw new Error("Exportação indisponível.");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "fintwin-conta.json";
    anchor.rel = "noopener";
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function StepUpExportLink({ className }: { className?: string }) {
  const { requestStepUp } = useSecurityStepUp();
  return (
    <button
      type="button"
      className={className}
      onClick={() => requestStepUp(() => void downloadAccountExport())}
    >
      Exportar dados da conta
    </button>
  );
}
