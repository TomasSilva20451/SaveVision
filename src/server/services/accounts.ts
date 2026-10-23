import { calculateAccountBalance } from "@/lib/finance/aggregates";
import {
  requireWorkspaceAccess,
  requireWorkspaceEditor,
} from "@/lib/auth/workspace-access";
import {
  civilDateFromInstant,
  startOfNextCivilMonth,
} from "@/lib/datetime/civil-date";
import type { LedgerMovement } from "@/lib/finance/types";
import { db } from "@/lib/db";
import { listWorkspaceMovements } from "@/server/repositories/ledger";
import { writeFinancialAuditLog } from "@/server/audit/financial-audit";
import { decimal } from "@/lib/finance/money";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"] as const;

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

  const account = await db.financialAccount.create({
    data: {
      workspaceId,
      ownerUserId: userId,
      name: input.name,
      institution: input.institution,
      type: input.type,
      openingBalance: decimal(input.openingBalance).toString(),
    },
  });
  await writeFinancialAuditLog({
    workspaceId,
    actorUserId: userId,
    action: "ACCOUNT_CREATED",
    entityType: "FinancialAccount",
    entityId: account.id,
    metadata: { name: account.name, type: account.type },
  });
  return account;
}

export async function archiveAccount(
  userId: string,
  workspaceId: string,
  accountId: string,
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return { ok: false, error: "Sem permissão para eliminar esta conta." };

  const account = await db.financialAccount.findFirst({
    where: { id: accountId, workspaceId, isArchived: false },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          recurringExpenses: { where: { status: "ACTIVE" } },
          incomeSeries: { where: { active: true } },
          incomeOccurrences: { where: { status: "EXPECTED" } },
          savingsGoals: { where: { archived: false } },
          investmentPositions: true,
        },
      },
    },
  });
  if (!account) return { ok: false, error: "Conta inexistente ou já eliminada." };

  const activeLinks =
    account._count.recurringExpenses +
    account._count.incomeSeries +
    account._count.incomeOccurrences +
    account._count.savingsGoals +
    account._count.investmentPositions;
  if (activeLinks > 0) {
    return {
      ok: false,
      error: "Antes de eliminar, altera ou remove as receitas, recorrências, objetivos ou investimentos associados a esta conta.",
    };
  }

  const archived = await db.financialAccount.updateMany({
    where: { id: account.id, workspaceId, isArchived: false },
    data: { isArchived: true },
  });
  if (archived.count !== 1) return { ok: false, error: "Não foi possível eliminar a conta." };

  await writeFinancialAuditLog({
    workspaceId,
    actorUserId: userId,
    action: "ACCOUNT_ARCHIVED",
    entityType: "FinancialAccount",
    entityId: account.id,
    metadata: { name: account.name },
  });

  return { ok: true, name: account.name };
}

export async function getAccountsPageData(userId: string, workspaceId: string) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const [accounts, movements, transactions] = await Promise.all([
    db.financialAccount.findMany({
      where: { workspaceId, isArchived: false },
      orderBy: { name: "asc" },
    }),
    listWorkspaceMovements(workspaceId),
    db.transaction.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { occurredAt: "desc" },
      include: {
        account: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
  ]);

  const rows = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    institution: account.institution,
    currentBalance: calculateAccountBalance(
      account.openingBalance.toString(),
      movements,
      account.id,
    ).toFixed(2),
  }));

  const now = civilDateFromInstant(new Date());
  const series = rows.map((account) => {
    const points: { label: string; balance: number }[] = [];
    for (let offset = 5; offset >= 0; offset -= 1) {
      let month = now.month - offset;
      let year = now.year;
      while (month < 1) {
        month += 12;
        year -= 1;
      }
      const cutoff = startOfNextCivilMonth(year, month);
      const slice: LedgerMovement[] = transactions
        .filter((tx) => tx.accountId === account.id && tx.occurredAt < cutoff)
        .map((tx) => ({
          accountId: tx.accountId,
          type: tx.type,
          status: tx.status,
          amount: tx.amount.toString(),
          deletedAt: tx.deletedAt,
        }));
      const opening = accounts.find((item) => item.id === account.id)?.openingBalance.toString() ?? "0";
      points.push({
        label: MONTH_LABELS[month - 1] ?? String(month),
        balance: Number(
          calculateAccountBalance(opening, slice, account.id).toFixed(2),
        ),
      });
    }
    return { id: account.id, name: account.name, points };
  });

  const hasMovementHistory = transactions.length > 0;

  return {
    accounts: rows,
    hasMovementHistory,
    series,
    recent: transactions.slice(0, 6).map((tx) => ({
      id: tx.id,
      description: tx.description,
      type: tx.type,
      amount: tx.amount.toString(),
      occurredAt: tx.occurredAt.toISOString(),
      accountName: tx.account.name,
      categoryName: tx.category?.name ?? null,
    })),
  };
}
