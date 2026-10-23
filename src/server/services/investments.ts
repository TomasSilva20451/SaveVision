import { requireWorkspaceAccess, requireWorkspaceEditor } from "@/lib/auth/workspace-access";
import {
  positionMarketValue,
  positionReturnPercent,
  positionUnrealizedPnl,
} from "@/lib/finance/investments";
import { db } from "@/lib/db";
import { findAccountInWorkspace } from "@/server/repositories/account-guard";
import { writeFinancialAuditLog } from "@/server/audit/financial-audit";
import { decimal } from "@/lib/finance/money";

export async function listInvestmentPositions(
  userId: string,
  workspaceId: string,
) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const rows = await db.investmentPosition.findMany({
    where: { workspaceId },
    orderBy: { symbol: "asc" },
  });

  return rows.map((row) => {
    const qty = row.quantity.toString();
    const price = row.manualPrice.toString();
    const cost = row.costBasis.toString();
    return {
      ...row,
      marketValue: positionMarketValue(qty, price),
      unrealizedPnl: positionUnrealizedPnl(qty, price, cost),
      returnPercent: positionReturnPercent(qty, price, cost),
    };
  });
}

export async function createInvestmentPosition(
  userId: string,
  workspaceId: string,
  input: {
    assetClass: "STOCK" | "ETF" | "BOND" | "FUND" | "CRYPTO" | "OTHER";
    symbol: string;
    name: string;
    quantity: string;
    costBasis: string;
    manualPrice: string;
    notes?: string;
    valuationMode?: "STANDALONE" | "ACCOUNT_COMPONENT";
    linkedAccountId?: string;
  },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const valuationMode = input.valuationMode ?? "STANDALONE";
  if (valuationMode === "ACCOUNT_COMPONENT" || input.linkedAccountId) {
    if (!input.linkedAccountId) return null;
    const account = await findAccountInWorkspace(workspaceId, input.linkedAccountId);
    if (!account) return null;
  }

  const row = await db.investmentPosition.create({
    data: {
      workspaceId,
      userId,
      assetClass: input.assetClass,
      symbol: input.symbol.toUpperCase(),
      name: input.name,
      quantity: decimal(input.quantity).toString(),
      costBasis: decimal(input.costBasis).toString(),
      manualPrice: decimal(input.manualPrice).toString(),
      notes: input.notes,
      valuationMode:
        valuationMode === "ACCOUNT_COMPONENT" ? "ACCOUNT_COMPONENT" : "STANDALONE",
      linkedAccountId: input.linkedAccountId ?? null,
    },
  });

  await writeFinancialAuditLog({
    workspaceId,
    actorUserId: userId,
    action: "INVESTMENT_CHANGED",
    entityType: "InvestmentPosition",
    entityId: row.id,
    metadata: {
      valuationMode: row.valuationMode,
      linkedAccountId: row.linkedAccountId,
    },
  });

  return row;
}
