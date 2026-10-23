import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import {
  civilDateFromInstant,
  formatCivilDateIso,
  parseCivilDateIso,
  startOfCivilDay,
} from "@/lib/datetime/civil-date";
import { calculateCashFlow, calculateExpenses, calculateIncome } from "@/lib/finance/aggregates";
import { decimal } from "@/lib/finance/money";
import type { LedgerMovement } from "@/lib/finance/types";
import { db } from "@/lib/db";

const PAGE_SIZE = 20;

const TYPES = ["INCOME", "EXPENSE", "TRANSFER", "ADJUSTMENT"] as const;

export type TransactionPageQuery = {
  q?: string;
  accountId?: string;
  categoryId?: string;
  type?: string;
  from?: string;
  to?: string;
  page?: string;
};

function addCivilDay(iso: string): Date {
  const date = parseCivilDateIso(iso);
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + 1));
  return startOfCivilDay({
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  });
}

function defaultRange() {
  const today = civilDateFromInstant(new Date());
  return {
    from: formatCivilDateIso({ year: today.year, month: today.month, day: 1 }),
    to: formatCivilDateIso(today),
  };
}

function toMovement(row: {
  accountId: string;
  type: LedgerMovement["type"];
  status: LedgerMovement["status"];
  amount: { toString(): string };
  deletedAt: Date | null;
}): LedgerMovement {
  return {
    accountId: row.accountId,
    type: row.type,
    status: row.status,
    amount: row.amount.toString(),
    deletedAt: row.deletedAt,
  };
}

export async function getTransactionsPage(
  userId: string,
  workspaceId: string,
  query: TransactionPageQuery,
) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const defaults = defaultRange();
  const from = query.from && /^\d{4}-\d{2}-\d{2}$/.test(query.from) ? query.from : defaults.from;
  const to = query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to) ? query.to : defaults.to;
  const page = Math.max(1, Number(query.page) || 1);
  const type = TYPES.includes(query.type as (typeof TYPES)[number]) ? query.type : undefined;

  const [accounts, categories] = await Promise.all([
    db.financialAccount.findMany({
      where: { workspaceId, isArchived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.category.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, nature: true },
    }),
  ]);

  const accountId = accounts.some((account) => account.id === query.accountId)
    ? query.accountId
    : undefined;
  const categoryId = categories.some((category) => category.id === query.categoryId)
    ? query.categoryId
    : undefined;

  const rows = await db.transaction.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      occurredAt: { gte: startOfCivilDay(parseCivilDateIso(from)), lt: addCivilDay(to) },
      ...(accountId ? { accountId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(type ? { type: type as (typeof TYPES)[number] } : {}),
      ...(query.q?.trim()
        ? { description: { contains: query.q.trim(), mode: "insensitive" } }
        : {}),
    },
    orderBy: { occurredAt: "desc" },
    include: {
      account: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  });

  const movements = rows.map(toMovement);
  const income = calculateIncome(movements);
  const expense = calculateExpenses(movements);
  const result = calculateCashFlow(movements);

  const byDay = new Map<string, { income: ReturnType<typeof decimal>; expense: ReturnType<typeof decimal> }>();
  for (const row of rows) {
    if (row.status !== "COMPLETED") continue;
    const key = formatCivilDateIso(civilDateFromInstant(row.occurredAt));
    const bucket = byDay.get(key) ?? { income: decimal(0), expense: decimal(0) };
    if (row.type === "INCOME") bucket.income = bucket.income.plus(row.amount.toString());
    if (row.type === "EXPENSE") bucket.expense = bucket.expense.plus(decimal(row.amount.toString()).abs());
    byDay.set(key, bucket);
  }

  const daily = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bucket]) => ({
      date: date.slice(8),
      income: Number(bucket.income.toFixed(2)),
      expense: Number(bucket.expense.toFixed(2)),
    }));

  const byCategory = new Map<string, ReturnType<typeof decimal>>();
  for (const row of rows) {
    if (row.type !== "EXPENSE" || row.status !== "COMPLETED") continue;
    const name = row.category?.name ?? "Sem categoria";
    byCategory.set(name, (byCategory.get(name) ?? decimal(0)).plus(decimal(row.amount.toString()).abs()));
  }
  const categoriesBreakdown = [...byCategory.entries()]
    .map(([name, value]) => ({ name, value: value.toFixed(2) }))
    .sort((a, b) => decimal(b.value).comparedTo(decimal(a.value)));

  const start = (page - 1) * PAGE_SIZE;

  return {
    from,
    to,
    page,
    pageSize: PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(rows.length / PAGE_SIZE)),
    filters: {
      q: query.q?.trim() ?? "",
      accountId: accountId ?? "",
      categoryId: categoryId ?? "",
      type: type ?? "",
    },
    accounts,
    categories,
    kpis: {
      income: income.toFixed(2),
      expense: expense.toFixed(2),
      result: result.toFixed(2),
      count: rows.length,
    },
    daily,
    categoriesBreakdown,
    rows: rows.slice(start, start + PAGE_SIZE).map((row) => ({
      id: row.id,
      occurredAt: row.occurredAt.toISOString(),
      description: row.description,
      type: row.type,
      amount: row.amount.toString(),
      accountId: row.account.id,
      accountName: row.account.name,
      categoryName: row.category?.name ?? null,
    })),
  };
}
