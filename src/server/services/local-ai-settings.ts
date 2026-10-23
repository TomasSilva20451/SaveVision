import "server-only";

import { db } from "@/lib/db";
import {
  checkOllamaHealth,
  isGlobalLocalAiEnabled,
  resolveOllamaBaseUrl,
} from "@/server/providers/ollama-config";

import type { LocalAiSettingsView } from "@/lib/help/local-ai-settings-types";
import { hasAcceptedConsent } from "@/server/services/privacy-consent";

export type LocalAiSettings = LocalAiSettingsView;

const DEFAULT_TEXT = process.env.OLLAMA_TRANSACTION_MODEL?.trim() || "qwen3.5:4b-mlx";
const DEFAULT_IMAGE =
  process.env.OLLAMA_RECEIPT_MODEL?.trim() ||
  process.env.OLLAMA_RECEIPT_FALLBACK_MODEL?.trim() ||
  "moondream:latest";
const DEFAULT_HELP = process.env.OLLAMA_HELP_MODEL?.trim() || "qwen2.5-coder:7b";

export async function getLocalAiSettings(userId: string): Promise<LocalAiSettings> {
  const row = await db.userLocalAiSettings.findUnique({ where: { userId } });
  const baseOverride = row?.ollamaBaseUrl ?? null;

  return {
    globalEnabled: isGlobalLocalAiEnabled(),
    localAiEnabled: row?.localAiEnabled ?? true,
    ollamaBaseUrl: resolveOllamaBaseUrl(baseOverride),
    textModel: row?.textModel?.trim() || DEFAULT_TEXT,
    imageModel: row?.imageModel?.trim() || DEFAULT_IMAGE,
    helpModel: row?.helpModel?.trim() || DEFAULT_HELP,
    storePrompts: row?.storePrompts ?? true,
  };
}

export function isLocalAiActive(settings: LocalAiSettings): boolean {
  return settings.globalEnabled && settings.localAiEnabled;
}

export async function saveLocalAiSettings(
  userId: string,
  input: {
    localAiEnabled: boolean;
    ollamaBaseUrl: string | null;
    textModel: string;
    imageModel: string;
    helpModel: string;
    storePrompts: boolean;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.localAiEnabled && !(await hasAcceptedConsent(userId, "local_ai_processing"))) {
    return {
      ok: false,
      error: "Aceita o consentimento «IA local (Ollama)» no centro de privacidade antes de activar.",
    };
  }
  if (input.storePrompts && !(await hasAcceptedConsent(userId, "prompt_storage"))) {
    return {
      ok: false,
      error: "Aceita o consentimento «Guardar prompts» no centro de privacidade ou desactiva o armazenamento.",
    };
  }
  const url = input.ollamaBaseUrl?.trim() || null;
  if (url) {
    try {
      resolveOllamaBaseUrl(url);
    } catch {
      return { ok: false, error: "Endereço Ollama inválido ou remoto não permitido." };
    }
  }

  const trimModel = (value: string, fallback: string) => {
    const v = value.trim();
    return v.length > 0 && v.length <= 128 ? v : fallback;
  };

  await db.userLocalAiSettings.upsert({
    where: { userId },
    create: {
      userId,
      localAiEnabled: input.localAiEnabled,
      ollamaBaseUrl: url,
      textModel: trimModel(input.textModel, DEFAULT_TEXT),
      imageModel: trimModel(input.imageModel, DEFAULT_IMAGE),
      helpModel: trimModel(input.helpModel, DEFAULT_HELP),
      storePrompts: input.storePrompts,
    },
    update: {
      localAiEnabled: input.localAiEnabled,
      ollamaBaseUrl: url,
      textModel: trimModel(input.textModel, DEFAULT_TEXT),
      imageModel: trimModel(input.imageModel, DEFAULT_IMAGE),
      helpModel: trimModel(input.helpModel, DEFAULT_HELP),
      storePrompts: input.storePrompts,
    },
  });

  return { ok: true };
}

export async function testLocalAiConnection(userId: string) {
  const settings = await getLocalAiSettings(userId);
  const health = await checkOllamaHealth(settings.ollamaBaseUrl);
  if (!health.ok) {
    return { ok: false as const, error: health.error };
  }
  const required = [settings.textModel, settings.helpModel, settings.imageModel];
  const missing = required.filter((name) => !health.models.some((m) => m === name || m.startsWith(`${name}:`)));
  return {
    ok: true as const,
    models: health.models,
    missingModels: missing,
  };
}
