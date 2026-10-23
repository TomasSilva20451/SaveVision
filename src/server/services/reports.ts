import PDFDocument from "pdfkit";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import {
  reportOpeningClosing,
  reportTotals,
  splitMovementsByPeriod,
  type TimedMovement,
} from "@/lib/finance/report-build";
import {
  defaultReportPeriod,
  formatReportPeriodLabel,
  isFullCivilMonthPeriod,
  isInstantInReportPeriod,
  parseCivilDateParam,
  buildReportPeriod,
  reportPeriodKey,
  type ReportPeriod,
} from "@/lib/finance/report-period";
import { getLatestMonthlyReportNarrative } from "@/server/services/monthly-report-narrative-queries";
import { formatEUR } from "@/lib/finance/money";
import { civilDateFromInstant, formatCivilDateIso } from "@/lib/datetime/civil-date";
import { db } from "@/lib/db";
import type { LedgerMovement } from "@/lib/finance/types";
import type { AccountSnapshot } from "@/lib/finance/types";

export type ReportQuery = {
  from?: string | null;
  to?: string | null;
  includeNarrative?: string | null;
};

function shouldIncludeNarrative(period: ReportPeriod, flag: string | null | undefined): boolean {
  if (flag === "0" || flag === "false") return false;
  if (flag === "1" || flag === "true") return true;
  return isFullCivilMonthPeriod(period);
}

function resolvePeriod(query: ReportQuery) {
  const from = parseCivilDateParam(query.from ?? null);
  const to = parseCivilDateParam(query.to ?? null);
  if (from && to) {
    return buildReportPeriod(from, to);
  }
  return defaultReportPeriod();
}

function toTimedMovement(tx: {
  accountId: string;
  type: string;
  status: string;
  amount: { toString(): string };
  deletedAt: Date | null;
  occurredAt: Date;
}): TimedMovement {
  return {
    accountId: tx.accountId,
    type: tx.type as LedgerMovement["type"],
    status: tx.status as LedgerMovement["status"],
    amount: tx.amount.toString(),
    deletedAt: tx.deletedAt,
    occurredAt: tx.occurredAt,
  };
}

export async function loadReportData(userId: string, workspaceId: string, query: ReportQuery) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const period = resolvePeriod(query);
  const [workspace, accounts, transactions] = await Promise.all([
    db.workspace.findUnique({ where: { id: workspaceId } }),
    db.financialAccount.findMany({
      where: { workspaceId, isArchived: false },
    }),
    db.transaction.findMany({
      where: { workspaceId, deletedAt: null },
      include: { category: true, account: true },
      orderBy: { occurredAt: "asc" },
    }),
  ]);

  const accountSnapshots: AccountSnapshot[] = accounts.map((account) => ({
    id: account.id,
    openingBalance: account.openingBalance.toString(),
    type: account.type,
    isIncludedInNetWorth: account.isIncludedInNetWorth,
    isArchived: account.isArchived,
  }));

  const timed = transactions.map(toTimedMovement);
  const { beforePeriod, inPeriod } = splitMovementsByPeriod(timed, period);
  const totals = reportTotals(inPeriod);
  const balances = reportOpeningClosing(accountSnapshots, beforePeriod, inPeriod);
  const periodTransactions = transactions.filter((tx) =>
    isInstantInReportPeriod(tx.occurredAt, period),
  );

  return {
    workspace,
    period,
    periodLabel: formatReportPeriodLabel(period),
    totals,
    balances,
    transactions: periodTransactions,
    movementCount: inPeriod.length,
  };
}

export async function buildFinancialReportCsv(
  userId: string,
  workspaceId: string,
  query: ReportQuery = {},
) {
  const data = await loadReportData(userId, workspaceId, query);
  if (!data) return null;

  const header =
    "data,conta,tipo,estado,montante,descricao,categoria\n";
  const lines = data.transactions.map((tx) => {
    const category = tx.category?.name ?? "";
    return [
      formatCivilDateIso(civilDateFromInstant(tx.occurredAt)),
      tx.account.name,
      tx.type,
      tx.status,
      tx.amount.toString(),
      (tx.description ?? "").replace(/"/g, '""'),
      category,
    ]
      .map((cell) => `"${cell}"`)
      .join(",");
  });

  let narrativeLine = "";
  if (shouldIncludeNarrative(data.period, query.includeNarrative)) {
    const narrative = await getLatestMonthlyReportNarrative(
      userId,
      workspaceId,
      reportPeriodKey(data.period),
    );
    if (narrative?.narrativeText) {
      narrativeLine = `"Narrativa","${narrative.narrativeText.replace(/"/g, '""')}"`;
    }
  }

  const summary = [
    "",
    `"Workspace","${data.workspace?.name ?? workspaceId}"`,
    `"Período","${data.periodLabel}"`,
    `"Gerado","${new Date().toISOString()}"`,
    ...(narrativeLine ? [narrativeLine] : []),
    `"Saldo inicial","${data.balances.opening}"`,
    `"Saldo final","${data.balances.closing}"`,
    `"Receitas","${data.totals.income}"`,
    `"Despesas","${data.totals.expenses}"`,
    `"Cash flow","${data.totals.cashFlow}"`,
    `"Volume transferências","${data.totals.transferVolume}"`,
    `"Movimentos no período","${data.movementCount}"`,
  ].join("\n");

  return header + lines.join("\n") + "\n" + summary;
}

export async function buildFinancialReportPdf(
  userId: string,
  workspaceId: string,
  query: ReportQuery = {},
): Promise<Buffer | null> {
  const data = await loadReportData(userId, workspaceId, query);
  if (!data) return null;

  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const finished = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.fontSize(18).text("Relatório financeiro FinTwin", { underline: true });
  doc.moveDown();
  doc.fontSize(11).text(`Workspace: ${data.workspace?.name ?? workspaceId}`);
  doc.text(`Período: ${data.periodLabel}`);
  doc.text(`Gerado: ${new Date().toISOString()}`);
  doc.moveDown();
  doc.text(`Saldo inicial: ${formatEUR(data.balances.opening)}`);
  doc.text(`Saldo final: ${formatEUR(data.balances.closing)}`);
  doc.text(`Património líquido (início): ${formatEUR(data.balances.netWorthOpening)}`);
  doc.text(`Património líquido (fim): ${formatEUR(data.balances.netWorthClosing)}`);
  doc.moveDown();
  doc.text(`Receitas: ${formatEUR(data.totals.income)}`);
  doc.text(`Despesas: ${formatEUR(data.totals.expenses)}`);
  doc.text(`Cash flow: ${formatEUR(data.totals.cashFlow)}`);
  doc.text(`Volume de transferências: ${formatEUR(data.totals.transferVolume)}`);
  doc.moveDown();
  doc.text(`Movimentos no período: ${data.movementCount}`);
  doc.moveDown();

  if (shouldIncludeNarrative(data.period, query.includeNarrative)) {
    const narrative = await getLatestMonthlyReportNarrative(
      userId,
      workspaceId,
      reportPeriodKey(data.period),
    );
    if (narrative?.narrativeText) {
      doc.fontSize(12).text("Resumo narrativo", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).text(narrative.narrativeText, { align: "justify", lineGap: 2 });
      doc.fontSize(8).fillColor("#666666").text(
        "Resumo gerado localmente; não constitui aconselhamento financeiro.",
      );
      doc.fillColor("#000000");
      doc.moveDown();
    }
  }

  doc.fontSize(11).text("Detalhe (listagem completa do período):", { underline: true });

  const lineHeight = 14;
  data.transactions.forEach((tx) => {
    if (doc.y > doc.page.height - 72) {
      doc.addPage();
    }
    doc.text(
      `${formatCivilDateIso(civilDateFromInstant(tx.occurredAt))} · ${tx.type} · ${tx.status} · ${formatEUR(tx.amount.toString())} · ${tx.account.name} · ${tx.description ?? ""}`,
      { lineGap: 2 },
    );
    doc.y += lineHeight - doc.currentLineHeight(true);
  });

  doc.end();
  return finished;
}

/** @deprecated use buildFinancialReportCsv */
export const buildMonthlyReportCsv = buildFinancialReportCsv;

/** @deprecated use buildFinancialReportPdf */
export const buildMonthlyReportPdf = buildFinancialReportPdf;
