"use client";

import { useState } from "react";
import Link from "next/link";
import { createEmailChangeVerificationLinkAction } from "@/lib/auth/profile-actions";
import { secondaryButtonClassName } from "@/components/ui/form-styles";

type Props = {
  currentEmail: string;
  pendingEmail: string;
};

export function PendingEmailVerification({ currentEmail, pendingEmail }: Props) {
  const [path, setPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function revealLink() {
    setError(null);
    setPending(true);
    const result = await createEmailChangeVerificationLinkAction();
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPath(result.path);
  }

  const absolute =
    path && typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      <p>
        Novo email pendente: <strong>{pendingEmail}</strong>. O login continua com <strong>{currentEmail}</strong> até confirmares.
      </p>
      <p className="mt-2 text-xs leading-5 opacity-90">
        Sem SMTP configurado, o FinTwin <strong>não envia email</strong>. Usa o botão abaixo para gerar o link e confirmar no browser.
      </p>
      <button type="button" className={`${secondaryButtonClassName} mt-3`} disabled={pending} onClick={() => void revealLink()}>
        {pending ? "A gerar link…" : "Obter link de confirmação"}
      </button>
      {error ? <p className="mt-2 text-xs text-red-700 dark:text-red-300">{error}</p> : null}
      {absolute ? (
        <div className="mt-3 space-y-2 text-xs">
          <p className="break-all font-mono select-all">{absolute}</p>
          <Link href={path!} className="inline-flex font-semibold text-blue-700 underline dark:text-blue-300">
            Abrir página de confirmação →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
