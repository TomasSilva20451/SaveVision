"use server";

import { revalidateFinancialPages } from "@/lib/cache/revalidate-financial";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";
import { archiveAccount, createAccount } from "@/server/services/accounts";
import { flashError, flashSuccess } from "@/lib/ui/action-feedback";
import { readReturnTo } from "@/lib/ui/form-return";
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

const ACCOUNTS_PATH = "/contas";
const TRANSACTIONS_PATH = "/transacoes";

function finishFormNavigation(formData: FormData) {
  const returnTo = readReturnTo(formData);
  if (returnTo) redirect(returnTo);
}

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

  const target = readReturnTo(formData) ?? ACCOUNTS_PATH;
  if (!parsed.success) {
    await flashError("Dados da conta inválidos.", target);
    finishFormNavigation(formData);
    return;
  }

  const account = await createAccount(user.id, selected.id, parsed.data);
  if (!account) {
    await flashError("Não foi possível criar a conta.", target);
    finishFormNavigation(formData);
    return;
  }
  await flashSuccess("Conta criada.", target);

  await revalidateFinancialPages(selected.id, ["/contas", "/transacoes"]);
  finishFormNavigation(formData);
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

  const target = readReturnTo(formData) ?? TRANSACTIONS_PATH;
  if (!parsed.success) {
    await flashError("Dados da transferência inválidos.", target);
    finishFormNavigation(formData);
    return;
  }

  const result = await createTransfer(user.id, selected.id, {
    ...parsed.data,
    occurredAt: new Date(),
  });

  if (!result.ok) {
    await flashError("Transferência não realizada. Verifica contas e montante.", target);
    finishFormNavigation(formData);
    return;
  }
  await flashSuccess("Transferência registada.", target);

  await revalidateFinancialPages(selected.id, ["/contas", "/transacoes"]);
  finishFormNavigation(formData);
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
  await revalidateFinancialPages(selected.id, [
    "/contas",
    "/dashboard",
    "/transacoes",
    "/patrimonio",
    "/previsoes",
  ]);
}
