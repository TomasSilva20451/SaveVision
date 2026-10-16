import { db } from "@/lib/db";

export async function findAccountInWorkspace(
  workspaceId: string,
  accountId: string,
) {
  return db.financialAccount.findFirst({
    where: { id: accountId, workspaceId, isArchived: false },
  });
}

export async function findCategoryInWorkspace(
  workspaceId: string,
  categoryId: string,
) {
  return db.category.findFirst({
    where: { id: categoryId, workspaceId },
  });
}
