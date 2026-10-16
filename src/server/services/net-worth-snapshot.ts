import { requireWorkspaceAccess, requireWorkspaceEditor } from "@/lib/auth/workspace-access";
import { calculatePatrimonyNet } from "@/lib/finance/patrimony";
import { calculateAccountBalance } from "@/lib/finance/aggregates";
import { decimal } from "@/lib/finance/money";
import { db } from "@/lib/db";
import { listWorkspaceMovements } from "@/server/repositories/ledger";
import { writeFinancialAuditLog } from "@/server/audit/financial-audit";

export async function listNetWorthSnapshots(userId: string, workspaceId: string) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  return db.netWorthSnapshot.findMany({
    where: { workspaceId },
    orderBy: { asOfDate: "asc" },
    take: 24,
  });
}

export async function captureNetWorthSnapshot(
  userId: string,
  workspaceId: string,
  asOfDate: Date = new Date(),
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const [accounts, movements, positions, liabilities] = await Promise.all([
    db.financialAccount.findMany({ where: { workspaceId, isArchived: false } }),
    listWorkspaceMovements(workspaceId),
    db.investmentPosition.findMany({ where: { workspaceId } }),
    db.financialLiability.findMany({ where: { workspaceId } }),
  ]);

  const accountSnapshots = accounts.map((a) => ({
    id: a.id,
    openingBalance: a.openingBalance.toString(),
    type: a.type,
    isIncludedInNetWorth: a.isIncludedInNetWorth,
    isArchived: a.isArchived,
  }));

  const patrimony = calculatePatrimonyNet({
    accounts: accountSnapshots,
    movements,
    investmentPositions: positions.map((p) => ({
      quantity: p.quantity.toString(),
      manualPrice: p.manualPrice.toString(),
      valuationMode: p.valuationMode,
      linkedAccountId: p.linkedAccountId,
    })),
    manualLiabilities: liabilities.map((l) => ({
      outstandingBalance: l.outstandingBalance.toString(),
    })),
  });

  const cashTotal = accounts
    .filter((a) => a.type === "CURRENT" || a.type === "CASH")
    .reduce(
      (sum, a) =>
        sum.plus(
          calculateAccountBalance(a.openingBalance.toString(), movements, a.id),
        ),
      decimal(0),
    );

  const savingsTotal = accounts
    .filter((a) => a.type === "SAVINGS")
    .reduce(
      (sum, a) =>
        sum.plus(
          calculateAccountBalance(a.openingBalance.toString(), movements, a.id),
        ),
      decimal(0),
    );

  const snapshot = await db.netWorthSnapshot.create({
    data: {
      workspaceId,
      userId,
      asOfDate,
      cashTotal: cashTotal.toFixed(2),
      savingsTotal: savingsTotal.toFixed(2),
      investmentsTotal: patrimony.investmentsValue,
      manualAssetsTotal: "0",
      liabilitiesTotal: patrimony.manualLiabilities,
      netWorth: patrimony.netPatrimony,
      calculationVersion: 1,
    },
  });

  await writeFinancialAuditLog({
    workspaceId,
    actorUserId: userId,
    action: "NET_WORTH_SNAPSHOT_CREATED",
    entityType: "NetWorthSnapshot",
    entityId: snapshot.id,
    metadata: { netWorth: patrimony.netPatrimony },
  });

  return snapshot;
}
