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
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          O administrador desactivou a IA local no servidor (FINTWIN_LOCAL_AI_ENABLED).
        </p>
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
            className={inputClassName}
            placeholder="http://127.0.0.1:11434"
          />
        </label>
        <label className={labelClassName}>
          Modelo de texto
          <input value={textModel} onChange={(event) => setTextModel(event.target.value)} className={inputClassName} />
        </label>
        <label className={labelClassName}>
          Modelo de ajuda
          <input value={helpModel} onChange={(event) => setHelpModel(event.target.value)} className={inputClassName} />
        </label>
        <label className={`${labelClassName} sm:col-span-2`}>
          Modelo de imagens (recibos)
          <input value={imageModel} onChange={(event) => setImageModel(event.target.value)} className={inputClassName} />
        </label>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={storePrompts}
          onChange={(event) => setStorePrompts(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300"
        />
        <span>
          Permitir registo de prompts na aplicação (quando disponível). Desactivar mantém o processamento efémero na ajuda
          contextual.
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={primaryButtonClassName} disabled={pending} onClick={save}>
          Guardar
        </button>
        <button type="button" className={secondaryButtonClassName} disabled={pending} onClick={testConnection}>
          Testar ligação
        </button>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      {testResult ? <p className="text-sm text-slate-700">{testResult}</p> : null}
    </div>
  );
}
