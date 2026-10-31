import { requireWorkspaceEditor } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db";
import { appendAuditEvent } from "@/server/audit/audit-ledger";
import type { Prisma } from "@/generated/prisma/client";

type TxClient = Prisma.TransactionClient;

export async function createTransferInTransaction(
  tx: TxClient,
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
  if (input.fromAccountId === input.toAccountId) {
    return { ok: false as const, reason: "same_account" as const };
  }

  const created = await tx.transfer.create({
    data: {
      workspaceId,
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      amount: input.amount,
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
        amount: `-${input.amount}`,
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
        amount: input.amount,
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

  return { ok: true as const, transfer: created };
}

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

  const transferResult = await db.$transaction(async (tx) =>
    createTransferInTransaction(tx, userId, workspaceId, { ...input, amount }),
  );
  if (!transferResult.ok) {
    return transferResult;
  }
  const transfer = transferResult.transfer;

  await appendAuditEvent({
    actorUserId: userId,
    workspaceId,
    action: "TRANSFER_CREATED",
    resourceType: "Transfer",
    resourceId: transfer.id,
    outcome: "SUCCESS",
    source: "financial-service",
    metadata: {
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
    },
  });

  return { ok: true as const, transfer };
}
