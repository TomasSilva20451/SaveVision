import { calculateAccountBalance } from "@/lib/finance/aggregates";
import {
  requireWorkspaceAccess,
  requireWorkspaceEditor,
} from "@/lib/auth/workspace-access";
import { db } from "@/lib/db";
import { listWorkspaceMovements } from "@/server/repositories/ledger";

export async function listAccountsWithBalances(
  userId: string,
  workspaceId: string,
) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);

  if (!membership) {
    return null;
  }

  const [accounts, movements] = await Promise.all([
    db.financialAccount.findMany({
      where: { workspaceId, isArchived: false },
      orderBy: { name: "asc" },
    }),
    listWorkspaceMovements(workspaceId),
  ]);

  return accounts.map((account) => ({
    ...account,
    openingBalance: account.openingBalance.toString(),
    currentBalance: calculateAccountBalance(
      account.openingBalance.toString(),
      movements,
      account.id,
    ).toFixed(2),
  }));
}

export async function createAccount(
  userId: string,
  workspaceId: string,
  input: {
    name: string;
    type: "CURRENT" | "SAVINGS" | "CASH" | "INVESTMENT" | "CRYPTO" | "LIABILITY" | "OTHER";
    openingBalance: string;
    institution?: string;
  },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);

  if (!membership) {
    return null;
  }

  return db.financialAccount.create({
    data: {
      workspaceId,
      ownerUserId: userId,
      name: input.name,
      institution: input.institution,
      type: input.type,
      openingBalance: input.openingBalance,
    },
  });
}
