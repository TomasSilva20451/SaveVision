"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";
import { archiveAccount, createAccount } from "@/server/services/accounts";
import { flashError, flashSuccess } from "@/lib/ui/action-feedback";
import { createTransfer } from "@/server/services/transfers";

const accountSchema = z.object({
  name: z.string().min(1, "Indica o nome da conta."),
  type: z.enum([
    "CURRENT",
    "SAVINGS",
    "CASH",
    "INVESTMENT",
    "CRYPTO",
    "LIABILITY",
    "OTHER",
  ]),
  openingBalance: z.string().min(1),
  institution: z.string().optional(),
});

const transferSchema = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amount: z.string().min(1),
  description: z.string().optional(),
});

export async function createAccountAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;

  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const parsed = accountSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    openingBalance: formData.get("openingBalance"),
    institution: formData.get("institution") || undefined,
  });

  if (!parsed.success) {
    await flashError("Dados da conta inválidos.");
    return;
  }

  const account = await createAccount(user.id, selected.id, parsed.data);
  if (!account) {
    await flashError("Não foi possível criar a conta.");
    return;
  }
  await flashSuccess("Conta criada.");

  revalidatePath("/contas");
  revalidatePath("/transacoes");
}

export async function createTransferAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;

  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const parsed = transferSchema.safeParse({
    fromAccountId: formData.get("fromAccountId"),
    toAccountId: formData.get("toAccountId"),
    amount: formData.get("amount"),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    await flashError("Dados da transferência inválidos.");
    return;
  }

  const result = await createTransfer(user.id, selected.id, {
    ...parsed.data,
    occurredAt: new Date(),
  });

  if (!result.ok) {
    await flashError("Transferência não realizada. Verifica contas e montante.");
    return;
  }
  await flashSuccess("Transferência registada.");

  revalidatePath("/contas");
  revalidatePath("/transacoes");
}

export async function archiveAccountAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user) return;

  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return;

  const result = await archiveAccount(
    user.id,
    selected.id,
    String(formData.get("accountId") ?? ""),
  );
  if (!result.ok) {
    await flashError(result.error, "/contas");
    return;
  }

  await flashSuccess(
    `A conta «${result.name}» foi eliminada da vista. O histórico financeiro foi preservado.`,
    "/contas",
  );
  revalidatePath("/contas");
  revalidatePath("/dashboard");
  revalidatePath("/transacoes");
  revalidatePath("/patrimonio");
  revalidatePath("/previsoes");
}
