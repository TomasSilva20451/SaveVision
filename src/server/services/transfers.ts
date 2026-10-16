import { requireWorkspaceEditor } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db";

export async function createTransfer(
  userId: string,
  workspaceId: string,
  input: {
    fromAccountId: string;
    toAccountId: string;
    amount: string;
    occurredAt: Date;
    description?: string;
  },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);

  if (!membership) {
    return { ok: false as const, reason: "forbidden" as const };
  }

  if (input.fromAccountId === input.toAccountId) {
    return { ok: false as const, reason: "same_account" as const };
  }

  const accounts = await db.financialAccount.findMany({
    where: {
      workspaceId,
      id: { in: [input.fromAccountId, input.toAccountId] },
      isArchived: false,
    },
  });

  if (accounts.length !== 2) {
    return { ok: false as const, reason: "invalid_accounts" as const };
  }

  const amount = input.amount;

  const transfer = await db.$transaction(async (tx) => {
    const created = await tx.transfer.create({
      data: {
        workspaceId,
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        amount,
        occurredAt: input.occurredAt,
        description: input.description,
        createdByUserId: userId,
      },
    });

    await tx.transaction.createMany({
      data: [
        {
          workspaceId,
          accountId: input.fromAccountId,
          userId,
          type: "TRANSFER",
          status: "COMPLETED",
          amount: `-${amount}`,
          occurredAt: input.occurredAt,
          description: input.description ?? "Transferência",
          transferId: created.id,
        },
        {
          workspaceId,
          accountId: input.toAccountId,
          userId,
          type: "TRANSFER",
          status: "COMPLETED",
          amount,
          occurredAt: input.occurredAt,
          description: input.description ?? "Transferência",
          transferId: created.id,
        },
      ],
    });

    await tx.auditLog.create({
      data: {
        actorUserId: userId,
        workspaceId,
        action: "CREATE_TRANSFER",
        entityType: "Transfer",
        entityId: created.id,
      },
    });

    return created;
  });

  return { ok: true as const, transfer };
}
