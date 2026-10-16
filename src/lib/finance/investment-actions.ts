"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";
import { createInvestmentPosition } from "@/server/services/investments";

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
    })
    .safeParse({
      assetClass: formData.get("assetClass"),
      symbol: formData.get("symbol"),
      name: formData.get("name"),
      quantity: formData.get("quantity"),
      costBasis: formData.get("costBasis"),
      manualPrice: formData.get("manualPrice"),
      notes: formData.get("notes") || undefined,
    });

  if (!parsed.success) return;

  await createInvestmentPosition(user.id, selected.id, parsed.data);
  revalidatePath("/investimentos");
}
