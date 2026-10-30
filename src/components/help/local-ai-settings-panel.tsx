"use client";

import { useState, useTransition } from "react";
import {
  saveLocalAiSettingsAction,
  testOllamaConnectionAction,
} from "@/lib/help/contextual-help-actions";
import type { LocalAiSettingsView } from "@/lib/help/local-ai-settings-types";
import { inputClassName, labelClassName, primaryButtonClassName, secondaryButtonClassName } from "@/components/ui/form-styles";

type Props = {
  initial: LocalAiSettingsView;
};

export function LocalAiSettingsPanel({ initial }: Props) {
  const unavailableOnThisInstallation = !initial.globalEnabled;
  const [localAiEnabled, setLocalAiEnabled] = useState(initial.localAiEnabled);
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState(initial.ollamaBaseUrl);
  const [textModel, setTextModel] = useState(initial.textModel);
  const [imageModel, setImageModel] = useState(initial.imageModel);
  const [helpModel, setHelpModel] = useState(initial.helpModel);
  const [storePrompts, setStorePrompts] = useState(initial.storePrompts);
  const [message, setMessage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (unavailableOnThisInstallation) return;
    setMessage(null);
    startTransition(async () => {
      const result = await saveLocalAiSettingsAction({
        localAiEnabled,
        ollamaBaseUrl,
        textModel,
        imageModel,
        helpModel,
        storePrompts,
      });
      setMessage(result.ok ? "Preferências guardadas." : result.error);
    });
  }

  function testConnection() {
    if (unavailableOnThisInstallation) return;
    setTestResult(null);
    startTransition(async () => {
      const result = await testOllamaConnectionAction();
      if (!result.ok) {
        setTestResult(result.error);
        return;
      }
      const missing =
        result.missingModels.length > 0
          ? ` Modelos em falta no Ollama: ${result.missingModels.join(", ")}.`
          : " Modelos configurados encontrados.";
      setTestResult(`Ligação OK (${result.models.length} modelos instalados).${missing}`);
    });
  }

  return (
    <div className="space-y-5">
      {!initial.globalEnabled ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100"
        >
          <p className="font-semibold">
            O consentimento está aceite, mas esta instalação online não alcança o Ollama do teu Mac.
          </p>
          <p className="mt-1 leading-6">
            Em Vercel, <code>127.0.0.1</code> identifica o servidor online, não o teu computador. Para manter os dados no
            Mac, executa o FinTwin localmente e abre esta página em{" "}
            <a
              className="font-semibold text-blue-700 underline hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
              href="http://127.0.0.1:3000/perfil/ia"
            >
              localhost:3000
            </a>.
          </p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
            A IA financeira continua desactivada nesta instalação pública; as funções manuais e determinísticas mantêm-se
            disponíveis.
          </p>
        </div>
      ) : null}

      <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950">
        <strong className="font-semibold">Processado localmente.</strong> Por omissão o FinTwin só contacta Ollama em
        localhost. Categorização, assistente, ajuda, recibos e resumos enviam apenas texto ou imagens necessários — nunca
        credenciais da aplicação.
      </p>

      <label className="flex items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          checked={localAiEnabled}
          onChange={(event) => setLocalAiEnabled(event.target.checked)}
          disabled={unavailableOnThisInstallation}
          className="h-4 w-4 rounded border-slate-300"
        />
        Activar IA local para esta conta
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={`${labelClassName} sm:col-span-2`}>
          Endereço Ollama
          <input
            value={ollamaBaseUrl}
            onChange={(event) => setOllamaBaseUrl(event.target.value)}
            disabled={unavailableOnThisInstallation}
            className={`${inputClassName} disabled:cursor-not-allowed disabled:opacity-60`}
            placeholder="http://127.0.0.1:11434"
          />
        </label>
        <label className={labelClassName}>
          Modelo de texto
          <input
            disabled={unavailableOnThisInstallation}
            value={textModel}
            onChange={(event) => setTextModel(event.target.value)}
            className={`${inputClassName} disabled:cursor-not-allowed disabled:opacity-60`}
          />
        </label>
        <label className={labelClassName}>
          Modelo de ajuda
          <input
            disabled={unavailableOnThisInstallation}
            value={helpModel}
            onChange={(event) => setHelpModel(event.target.value)}
            className={`${inputClassName} disabled:cursor-not-allowed disabled:opacity-60`}
          />
        </label>
        <label className={`${labelClassName} sm:col-span-2`}>
          Modelo de imagens (recibos)
          <input
            disabled={unavailableOnThisInstallation}
            value={imageModel}
            onChange={(event) => setImageModel(event.target.value)}
            className={`${inputClassName} disabled:cursor-not-allowed disabled:opacity-60`}
          />
        </label>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={storePrompts}
          onChange={(event) => setStorePrompts(event.target.checked)}
          disabled={unavailableOnThisInstallation}
          className="mt-1 h-4 w-4 rounded border-slate-300"
        />
        <span>
          Permitir registo de prompts na aplicação (quando disponível). Desactivar mantém o processamento efémero na ajuda
          contextual.
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={primaryButtonClassName}
          disabled={pending || unavailableOnThisInstallation}
          onClick={save}
        >
          Guardar
        </button>
        <button
          type="button"
          className={secondaryButtonClassName}
          disabled={pending || unavailableOnThisInstallation}
          onClick={testConnection}
        >
          Testar ligação
        </button>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      {testResult ? <p className="text-sm text-slate-700">{testResult}</p> : null}
    </div>
  );
}
