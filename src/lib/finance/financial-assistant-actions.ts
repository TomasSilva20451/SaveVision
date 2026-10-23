"use server";

import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { askFinancialAssistant } from "@/server/services/financial-assistant";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

const questionSchema = z.string().trim().min(4).max(500);

export type FinancialAssistantActionResult = Awaited<ReturnType<typeof askFinancialAssistant>>;

export async function askFinancialAssistantAction(
  question: string,
): Promise<FinancialAssistantActionResult> {
  const user = await requireAuthenticatedUser();
  if (!user) return { ok: false, error: "Inicia sessão para usar o assistente." };

  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return { ok: false, error: "Seleciona primeiro um workspace." };

  const parsed = questionSchema.safeParse(question);
  if (!parsed.success) {
    return { ok: false, error: "Escreve uma pergunta válida (4–500 caracteres)." };
  }

  return askFinancialAssistant(user.id, selected.id, parsed.data);
}
