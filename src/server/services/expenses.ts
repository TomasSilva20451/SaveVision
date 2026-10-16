import { requireWorkspaceAccess, requireWorkspaceEditor } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db";
import {
  findAccountInWorkspace,
  findCategoryInWorkspace,
} from "@/server/repositories/account-guard";

const DEFAULT_CATEGORIES = [
  { name: "Habitação", nature: "NECESSARY" as const, behavior: "FIXED" as const },
  { name: "Alimentação", nature: "NECESSARY" as const, behavior: "VARIABLE" as const },
  { name: "Transportes", nature: "NECESSARY" as const, behavior: "VARIABLE" as const },
  { name: "Lazer", nature: "DISCRETIONARY" as const, behavior: "VARIABLE" as const },
];

export async function ensureDefaultCategories(workspaceId: string) {
  for (const category of DEFAULT_CATEGORIES) {
    await db.category.upsert({
      where: {
        workspaceId_name: { workspaceId, name: category.name },
      },
      update: {},
      create: { workspaceId, ...category },
    });
  }
}

export async function createExpense(
  userId: string,
  workspaceId: string,
  input: {
    accountId: string;
    amount: string;
    description: string;
    categoryId?: string;
    occurredAt: Date;
  },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const account = await findAccountInWorkspace(workspaceId, input.accountId);
  if (!account) return null;

  if (input.categoryId) {
    const category = await findCategoryInWorkspace(workspaceId, input.categoryId);
    if (!category) return null;
  }

  await ensureDefaultCategories(workspaceId);

  const amount = input.amount.startsWith("-")
    ? input.amount
    : `-${input.amount}`;

  return db.transaction.create({
    data: {
      workspaceId,
      accountId: input.accountId,
      userId,
      type: "EXPENSE",
      status: "COMPLETED",
      amount,
      occurredAt: input.occurredAt,
      description: input.description,
      categoryId: input.categoryId,
    },
  });
}

export async function listExpenses(userId: string, workspaceId: string) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  await ensureDefaultCategories(workspaceId);

  const [categories, transactions] = await Promise.all([
    db.category.findMany({ where: { workspaceId }, orderBy: { name: "asc" } }),
    db.transaction.findMany({
      where: { workspaceId, type: "EXPENSE", deletedAt: null },
      orderBy: { occurredAt: "desc" },
      take: 50,
      include: { category: true, account: { select: { name: true } } },
    }),
  ]);

  return { categories, transactions };
}
