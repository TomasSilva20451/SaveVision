"use client";

import { useState } from "react";
import Link from "next/link";
import {
  acceptPrivacyConsentAction,
  requestSubjectErasureAction,
  type PrivacyCenterState,
} from "@/lib/privacy/privacy-actions";
import { retentionLabel } from "@/lib/privacy/retention-policy";
import { secondaryButtonClassName, primaryButtonClassName, labelClassName, inputClassName } from "@/components/ui/form-styles";

type Props = {
  state: PrivacyCenterState;
  stepUpActive: boolean;
};

export function PrivacyCenterPanel({ state, stepUpActive }: Props) {
  const [exporting, setExporting] = useState(false);
  const acceptedSet = new Set(state.accepted.map((a) => `${a.consentKey}@${a.version}`));

  async function downloadExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/privacy/export", { credentials: "include" });
      if (!res.ok) {
        alert(res.status === 403 ? "Confirma a identidade no centro de segurança." : "Exportação falhou.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fintwin-dados-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="font-semibold">Consentimentos versionados</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Cada versão fica registada com data. Ver documentação «PRIVACY_GOVERNANCE» e «OLLAMA_PRIVACY» no repositório.
        </p>
        <ul className="mt-4 space-y-3">
          {state.catalog.map((def) => {
            const ok = acceptedSet.has(`${def.key}@${def.version}`);
            return (
              <li key={`${def.key}-${def.version}`} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900/50">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{def.title}</p>
                    <p className="text-xs text-slate-500">
                      v{def.version} · base legal: {def.legalBasis} · {def.required ? "obrigatório" : "opcional"}
                    </p>
                    <p className="mt-1 text-sm">{def.purpose}</p>
                  </div>
                  {ok ? (
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Aceite</span>
                  ) : (
                    <form action={acceptPrivacyConsentAction}>
                      <input type="hidden" name="consentKey" value={def.key} />
                      <button type="submit" className={secondaryButtonClassName}>
                        Aceitar v{def.version}
                      </button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="font-semibold">Retenção e categorias</h2>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {(
            [
              ["account_profile", "Perfil e credenciais"],
              ["financial_transactions", "Movimentos financeiros"],
              ["documents", "Documentos e recibos"],
              ["security_events", "Eventos de segurança"],
              ["local_ai_prompt_cache", "Cache de prompts IA"],
            ] as const
          ).map(([key, label]) => (
            <li key={key} className="rounded-lg border border-[var(--border)] px-3 py-2">
              <span className="font-medium">{label}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{retentionLabel(key)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="font-semibold">Exportação do titular</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Inclui perfil, workspaces, amostra de transacções (500), consentimentos e metadados de IA local. Requer confirmação
          reforçada.
        </p>
        {!stepUpActive ? (
          <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">
            <Link href="/perfil/seguranca" className="font-semibold underline">
              Confirma a identidade
            </Link>{" "}
            para exportar ou eliminar.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={primaryButtonClassName} disabled={exporting} onClick={() => void downloadExport()}>
              {exporting ? "A exportar…" : "Descarregar JSON (completo)"}
            </button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 dark:border-rose-900 dark:bg-rose-950/30">
        <h2 className="font-semibold text-rose-950 dark:text-rose-100">Eliminação verificável</h2>
        <p className="mt-1 text-sm text-rose-900/90 dark:text-rose-100/90">
          Anonimiza a conta, revoga sessões e remove MFA/passkeys. Os movimentos nos workspaces podem permanecer por
          obrigações contabilísticas — sem identificação pessoal recuperável. Gera comprovativo SHA-256 (
          {state.erasurePolicyVersion}).
        </p>
        {stepUpActive ? (
          <form action={requestSubjectErasureAction} className="mt-4 space-y-3">
            <input type="hidden" name="policyVersion" value={state.erasurePolicyVersion} />
            <label className={labelClassName}>
              Escreve ELIMINAR A MINHA CONTA
              <input name="confirm" required className={inputClassName} autoComplete="off" />
            </label>
            <button type="submit" className={`${primaryButtonClassName} bg-rose-700 hover:bg-rose-800`}>
              Eliminar conta (irreversível)
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
