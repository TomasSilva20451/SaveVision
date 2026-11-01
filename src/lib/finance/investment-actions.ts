"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";
import { createInvestmentPosition } from "@/server/services/investments";
import { flashError, flashSuccess } from "@/lib/ui/action-feedback";
import { readReturnTo } from "@/lib/ui/form-return";

const INVESTMENTS_PATH = "/investimentos";

export async function createInvestmentPositionAction(
  formData: FormData,
): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const parsed = z
    .object({
      assetClass: z.enum(["STOCK", "ETF", "BOND", "FUND", "CRYPTO", "OTHER"]),
      symbol: z.string().min(1),
      name: z.string().min(1),
      quantity: z.string().min(1),
      costBasis: z.string().min(1),
      manualPrice: z.string().min(1),
      notes: z.string().optional(),
      valuationMode: z.enum(["STANDALONE", "ACCOUNT_COMPONENT"]),
      linkedAccountId: z.string().optional(),
    })
    .safeParse({
      assetClass: formData.get("assetClass"),
      symbol: formData.get("symbol"),
      name: formData.get("name"),
      quantity: formData.get("quantity"),
      costBasis: formData.get("costBasis"),
      manualPrice: formData.get("manualPrice"),
      notes: formData.get("notes") || undefined,
      valuationMode: formData.get("valuationMode") || "STANDALONE",
      linkedAccountId: formData.get("linkedAccountId") || undefined,
    });

  const target = readReturnTo(formData) ?? INVESTMENTS_PATH;
  if (!parsed.success) {
    await flashError("Dados da posição inválidos.", target);
    const returnTo = readReturnTo(formData);
    if (returnTo) redirect(returnTo);
    return;
  }

  const created = await createInvestmentPosition(user.id, selected.id, parsed.data);
  if (!created) {
    await flashError("Não foi possível registar a posição.", target);
    const returnTo = readReturnTo(formData);
    if (returnTo) redirect(returnTo);
    return;
  }
  await flashSuccess("Posição registada.", target);
  revalidatePath("/investimentos");
  const returnTo = readReturnTo(formData);
  if (returnTo) redirect(returnTo);
}
