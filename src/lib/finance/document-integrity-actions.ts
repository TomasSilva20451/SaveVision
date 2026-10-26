"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { flashError, flashSuccess } from "@/lib/ui/action-feedback";
import { runDocumentIntegrityScanForWorkspace } from "@/server/services/document-integrity";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

export async function scanDocumentIntegrityAction(): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;

  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const report = await runDocumentIntegrityScanForWorkspace(user.id, selected.id);
  if (!report) {
    await flashError("Verificação reservada a gestores do workspace.");
    return;
  }

  await flashSuccess(
    `Verificados ${report.scanned} documentos — ${report.missing} em falta, ${report.decryptFail} ilegíveis, ${report.quarantined} em quarentena.`,
  );
  revalidatePath("/empresa/auditoria");
  revalidatePath("/relatorios");
}
