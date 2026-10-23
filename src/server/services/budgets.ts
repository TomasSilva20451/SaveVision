import { requireWorkspaceAccess, requireWorkspaceEditor } from "@/lib/auth/workspace-access";
import {
  budgetAvailable,
  budgetOverage,
  budgetUtilizationPercent,
  summarizeBudgetMonth,
  type BudgetLineSnapshot,
} from "@/lib/finance/budget";
import { isInstantInCivilMonth } from "@/lib/datetime/civil-date";
import { decimal } from "@/lib/finance/money";
import { db } from "@/lib/db";
import { findCategoryInWorkspace } from "@/server/repositories/account-guard";
import { ensureDefaultCategories } from "@/server/services/expenses";
import { writeFinancialAuditLog } from "@/server/audit/financial-audit";

function expenseAmount(raw: string): string {
  return decimal(raw).abs().toFixed(2);
}

async function spentByCategory(
  workspaceId: string,
  year: number,
  month: number,
): Promise<Map<string, { name: string; spent: string }>> {
  const rows = await db.transaction.findMany({
    where: { workspaceId, type: "EXPENSE", status: "COMPLETED", deletedAt: null },
    include: { category: true },
  });
  const map = new Map<string, { name: string; spent: string }>();
  for (const tx of rows) {
    if (!isInstantInCivilMonth(tx.occurredAt, year, month)) continue;
    const categoryId = tx.categoryId ?? "uncategorized";
    const name = tx.category?.name ?? "Sem categoria";
    const prev = map.get(categoryId);
    const add = expenseAmount(tx.amount.toString());
    if (prev) {
      map.set(categoryId, {
        name: prev.name,
        spent: decimal(prev.spent).plus(add).toFixed(2),
      });
    } else {
      map.set(categoryId, { name, spent: add });
    }
  }
  return map;
}

export async function getBudgetOverview(
  userId: string,
  workspaceId: string,
  year: number,
  month: number,
) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  await ensureDefaultCategories(workspaceId);

  const [budget, spentMap, categories] = await Promise.all([
    db.monthlyBudget.findUnique({
      where: { workspaceId_year_month: { workspaceId, year, month } },
      include: { lines: { include: { category: true } } },
    }),
    spentByCategory(workspaceId, year, month),
    db.category.findMany({ where: { workspaceId }, orderBy: { name: "asc" } }),
  ]);

  const lines: BudgetLineSnapshot[] = budget
    ? budget.lines.map((line) => {
        const spent = spentMap.get(line.categoryId)?.spent ?? "0";
        return {
          categoryId: line.categoryId,
          categoryName: line.category.name,
          limitAmount: line.limitAmount.toString(),
          spentAmount: spent,
        };
      })
    : [];

  const enriched = budget
    ? budget.lines.map((line) => {
        const spent = spentMap.get(line.categoryId)?.spent ?? "0";
        const snapshot: BudgetLineSnapshot = {
          categoryId: line.categoryId,
          categoryName: line.category.name,
          limitAmount: line.limitAmount.toString(),
          spentAmount: spent,
        };
        return {
          lineId: line.id,
          ...snapshot,
          available: budgetAvailable(snapshot.limitAmount, snapshot.spentAmount),
          utilizationPercent: budgetUtilizationPercent(
            snapshot.limitAmount,
            snapshot.spentAmount,
          ),
          overage: budgetOverage(snapshot.limitAmount, snapshot.spentAmount),
        };
      })
    : [];

  return {
    budget,
    year,
    month,
    summary: summarizeBudgetMonth(lines),
    lines: enriched,
    categories,
    spentMap: Object.fromEntries(spentMap),
  };
}

export async function upsertBudgetLine(
  userId: string,
  workspaceId: string,
  input: { year: number; month: number; categoryId: string; limitAmount: string },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const category = await findCategoryInWorkspace(workspaceId, input.categoryId);
  if (!category) return null;

  const budget = await db.monthlyBudget.upsert({
    where: {
      workspaceId_year_month: {
        workspaceId,
        year: input.year,
        month: input.month,
      },
    },
    create: { workspaceId, year: input.year, month: input.month },
    update: {},
  });

  const line = await db.budgetLine.upsert({
    where: {
      monthlyBudgetId_categoryId: {
        monthlyBudgetId: budget.id,
        categoryId: input.categoryId,
      },
    },
    create: {
      monthlyBudgetId: budget.id,
      categoryId: input.categoryId,
      limitAmount: input.limitAmount,
    },
    update: { limitAmount: input.limitAmount },
  });
  await writeFinancialAuditLog({
    workspaceId,
    actorUserId: userId,
    action: "BUDGET_CHANGED",
    entityType: "BudgetLine",
    entityId: line.id,
    metadata: { operation: "UPSERT", year: input.year, month: input.month },
  });
  return line;
}

export async function deleteBudgetLine(
  userId: string,
  workspaceId: string,
  lineId: string,
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const line = await db.budgetLine.findFirst({
    where: { id: lineId, monthlyBudget: { workspaceId } },
  });
  if (!line) return null;
  await db.budgetLine.delete({ where: { id: line.id } });
  await writeFinancialAuditLog({
    workspaceId,
    actorUserId: userId,
    action: "BUDGET_CHANGED",
    entityType: "BudgetLine",
    entityId: line.id,
    metadata: { operation: "DELETE" },
  });
  return true;
}

export async function deleteMonthlyBudget(
  userId: string,
  workspaceId: string,
  year: number,
  month: number,
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const deleted = await db.monthlyBudget.deleteMany({
    where: { workspaceId, year, month },
  });
  await writeFinancialAuditLog({
    workspaceId,
    actorUserId: userId,
    action: "BUDGET_CHANGED",
    entityType: "MonthlyBudget",
    entityId: `${workspaceId}:${year}-${month}`,
    metadata: { operation: "DELETE", deleted: deleted.count, year, month },
  });
  return true;
}
