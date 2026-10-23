"use server";

import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { askContextualHelp, explainCurrentPage } from "@/server/services/contextual-help";
import {
  getLocalAiSettings,
  saveLocalAiSettings,
  testLocalAiConnection,
} from "@/server/services/local-ai-settings";

export async function askContextualHelpAction(input: { question: string; pathname: string }) {
  const user = await requireAuthenticatedUser();
  if (!user) return { ok: false as const, error: "Inicia sessão para usar a ajuda." };

  return askContextualHelp(user.id, input.question, input.pathname);
}

export async function explainCurrentPageAction(pathname: string) {
  const user = await requireAuthenticatedUser();
  if (!user) return { ok: false as const, error: "Inicia sessão para usar a ajuda." };
  return explainCurrentPage(user.id, pathname);
}

export async function getLocalAiSettingsAction() {
  const user = await requireAuthenticatedUser();
  if (!user) return { ok: false as const, error: "Sessão expirada." };
  const settings = await getLocalAiSettings(user.id);
  return { ok: true as const, settings };
}

export async function saveLocalAiSettingsAction(input: {
  localAiEnabled: boolean;
  ollamaBaseUrl: string;
  textModel: string;
  imageModel: string;
  helpModel: string;
  storePrompts: boolean;
}) {
  const user = await requireAuthenticatedUser();
  if (!user) return { ok: false as const, error: "Sessão expirada." };

  const url = input.ollamaBaseUrl.trim();
  return saveLocalAiSettings(user.id, {
    localAiEnabled: input.localAiEnabled,
    ollamaBaseUrl: url.length > 0 ? url : null,
    textModel: input.textModel,
    imageModel: input.imageModel,
    helpModel: input.helpModel,
    storePrompts: input.storePrompts,
  });
}

export async function testOllamaConnectionAction() {
  const user = await requireAuthenticatedUser();
  if (!user) return { ok: false as const, error: "Sessão expirada." };
  return testLocalAiConnection(user.id);
}
