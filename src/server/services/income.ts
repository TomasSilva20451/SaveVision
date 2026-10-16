import {
  requireWorkspaceAccess,
  requireWorkspaceEditor,
} from "@/lib/auth/workspace-access";
import { canConfirmOccurrence } from "@/lib/finance/income-occurrence";
import { calculateEcommerceNetProceeds } from "@/lib/finance/ecommerce";
import { calculateTennisNetPrize } from "@/lib/finance/tennis";
import { db } from "@/lib/db";
import { writeFinancialAuditLog } from "@/server/audit/financial-audit";
import { findAccountInWorkspace } from "@/server/repositories/account-guard";

export async function createOneOffIncome(
  userId: string,
  workspaceId: string,
  input: {
    accountId: string;
    amount: string;
    description: string;
    occurredAt: Date;
    status: "COMPLETED" | "EXPECTED";
    sourceType: "SALARY" | "FREELANCE" | "GIFT" | "OTHER";
  },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const account = await findAccountInWorkspace(workspaceId, input.accountId);
  if (!account) return null;

  return db.transaction.create({
    data: {
      workspaceId,
      accountId: account.id,
      userId,
      type: "INCOME",
      status: input.status,
      amount: input.amount,
      occurredAt: input.occurredAt,
      description: input.description,
    },
  });
}

export async function createFamilyIncomeSeries(
  userId: string,
  workspaceId: string,
  input: {
    accountId: string;
    familyOrigin: string;
    amount: string;
    frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
    nextDueAt: Date;
    certainty: "HIGH" | "MEDIUM" | "LOW";
    endAt?: Date;
  },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const account = await findAccountInWorkspace(workspaceId, input.accountId);
  if (!account) return null;

  return db.$transaction(async (tx) => {
    const series = await tx.incomeSeries.create({
      data: {
        workspaceId,
        userId,
        sourceType: "FAMILY_TRANSFER",
        title: `Transferência familiar · ${input.familyOrigin}`,
        amount: input.amount,
        frequency: input.frequency,
        accountId: input.accountId,
        familyOrigin: input.familyOrigin,
        certainty: input.certainty,
        nextDueAt: input.nextDueAt,
        endAt: input.endAt,
      },
    });

    await tx.incomeOccurrence.create({
      data: {
        workspaceId,
        userId,
        seriesId: series.id,
        sourceType: "FAMILY_TRANSFER",
        status: "EXPECTED",
        expectedAmount: input.amount,
        scheduledFor: input.nextDueAt,
        accountId: input.accountId,
        title: series.title,
      },
    });

    return series;
  });
}

export async function confirmIncomeOccurrence(
  userId: string,
  workspaceId: string,
  occurrenceId: string,
  receivedAt: Date,
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return { ok: false as const, reason: "forbidden" as const };

  const occurrence = await db.incomeOccurrence.findFirst({
    where: { id: occurrenceId, workspaceId },
  });

  if (!occurrence) {
    return { ok: false as const, reason: "not_found" as const };
  }

  const decision = canConfirmOccurrence({
    status: occurrence.status,
    transactionId: occurrence.transactionId,
  });

  if (!decision.ok) {
    return { ok: false as const, reason: decision.reason };
  }

  if (decision.alreadyConfirmed) {
    return { ok: true as const, alreadyConfirmed: true as const };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const txRow = await tx.transaction.create({
        data: {
          workspaceId,
          accountId: occurrence.accountId,
          userId,
          type: "INCOME",
          status: "COMPLETED",
          amount: occurrence.expectedAmount.toString(),
          occurredAt: receivedAt,
          description: occurrence.title,
        },
      });

      const updated = await tx.incomeOccurrence.updateMany({
        where: {
          id: occurrence.id,
          workspaceId,
          status: "EXPECTED",
          transactionId: null,
        },
        data: {
          status: "RECEIVED",
          transactionId: txRow.id,
        },
      });

      if (updated.count !== 1) {
        throw new Error("INCOME_ALREADY_CONFIRMED");
      }

      return txRow;
    });

    await writeFinancialAuditLog({
      workspaceId,
      actorUserId: userId,
      action: "INCOME_CONFIRMED",
      entityType: "IncomeOccurrence",
      entityId: occurrenceId,
      metadata: { transactionId: result.id },
    });

    return { ok: true as const, alreadyConfirmed: false as const, transaction: result };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "INCOME_ALREADY_CONFIRMED"
    ) {
      return { ok: true as const, alreadyConfirmed: true as const };
    }
    throw error;
  }
}

export async function createEcommerceSaleRecord(
  userId: string,
  workspaceId: string,
  input: {
    accountId: string;
    marketplace?: string;
    orderReference?: string;
    grossAmount: string;
    marketplaceFees?: string;
    paymentFees?: string;
    shippingCost?: string;
    costOfGoods?: string;
    otherCosts?: string;
    taxReservePercentage?: string;
    saleDate: Date;
    recordPayout: boolean;
  },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const account = await findAccountInWorkspace(workspaceId, input.accountId);
  if (!account) return null;

  const { netProceeds, taxReserveAmount } = calculateEcommerceNetProceeds(input);

  return db.$transaction(async (tx) => {
    let transactionId: string | undefined;

    if (input.recordPayout) {
      const movement = await tx.transaction.create({
        data: {
          workspaceId,
          accountId: input.accountId,
          userId,
          type: "INCOME",
          status: "COMPLETED",
          amount: netProceeds.toString(),
          occurredAt: input.saleDate,
          description: `Venda e-commerce${input.orderReference ? ` · ${input.orderReference}` : ""}`,
        },
      });
      transactionId = movement.id;
    }

    return tx.ecommerceSale.create({
      data: {
        workspaceId,
        userId,
        accountId: input.accountId,
        marketplace: input.marketplace,
        orderReference: input.orderReference,
        grossAmount: input.grossAmount,
        marketplaceFees: input.marketplaceFees ?? 0,
        paymentFees: input.paymentFees ?? 0,
        shippingCost: input.shippingCost ?? 0,
        costOfGoods: input.costOfGoods ?? 0,
        otherCosts: input.otherCosts ?? 0,
        netProceeds: netProceeds.toString(),
        taxReservePercentage: input.taxReservePercentage ?? 0,
        taxReserveAmount: taxReserveAmount.toString(),
        saleDate: input.saleDate,
        payoutDate: input.recordPayout ? input.saleDate : null,
        transactionId,
      },
    });
  });
}

export async function createTournamentIncomeRecord(
  userId: string,
  workspaceId: string,
  input: {
    accountId: string;
    tournamentName: string;
    tournamentDate: Date;
    location?: string;
    grossPrize: string;
    registrationFee?: string;
    travelCost?: string;
    accommodationCost?: string;
    foodCost?: string;
    otherCosts?: string;
    recordPayout: boolean;
  },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const account = await findAccountInWorkspace(workspaceId, input.accountId);
  if (!account) return null;

  const netPrize = calculateTennisNetPrize(input);

  return db.$transaction(async (tx) => {
    let transactionId: string | undefined;

    if (input.recordPayout && netPrize.greaterThan(0)) {
      const movement = await tx.transaction.create({
        data: {
          workspaceId,
          accountId: input.accountId,
          userId,
          type: "INCOME",
          status: "COMPLETED",
          amount: netPrize.toString(),
          occurredAt: input.tournamentDate,
          description: `Torneio · ${input.tournamentName}`,
        },
      });
      transactionId = movement.id;
    }

    return tx.tournamentIncome.create({
      data: {
        workspaceId,
        userId,
        accountId: input.accountId,
        tournamentName: input.tournamentName,
        tournamentDate: input.tournamentDate,
        location: input.location,
        grossPrize: input.grossPrize,
        registrationFee: input.registrationFee ?? 0,
        travelCost: input.travelCost ?? 0,
        accommodationCost: input.accommodationCost ?? 0,
        foodCost: input.foodCost ?? 0,
        otherCosts: input.otherCosts ?? 0,
        netPrize: netPrize.toString(),
        transactionId,
      },
    });
  });
}

export async function listIncomeOverview(userId: string, workspaceId: string) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const [occurrences, sales, tournaments] = await Promise.all([
    db.incomeOccurrence.findMany({
      where: { workspaceId },
      orderBy: { scheduledFor: "desc" },
      take: 30,
    }),
    db.ecommerceSale.findMany({
      where: { workspaceId },
      orderBy: { saleDate: "desc" },
      take: 20,
    }),
    db.tournamentIncome.findMany({
      where: { workspaceId },
      orderBy: { tournamentDate: "desc" },
      take: 20,
    }),
  ]);

  return { occurrences, sales, tournaments };
}
