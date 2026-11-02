import "server-only";

import { revalidatePath } from "next/cache";
import { invalidateWorkspaceReadCache } from "@/lib/cache/redis-cache";

export async function revalidateFinancialPages(
  workspaceId: string,
  paths: string[],
): Promise<void> {
  await invalidateWorkspaceReadCache(workspaceId);
  for (const path of paths) {
    revalidatePath(path);
  }
}
