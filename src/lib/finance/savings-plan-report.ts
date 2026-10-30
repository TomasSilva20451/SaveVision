import { isInstantInCivilMonth } from "@/lib/datetime/civil-date";
import { budgetUtilizationPercent, type BudgetLineSnapshot } from "@/lib/finance/budget";
import { decimal } from "@/lib/finance/money";
import { computePlanProgress, weeksRemaining } from "@/lib/finance/savings-plan-engine";
import { civilDateFromInstant, formatCivilDateIso } from "@/lib/datetime/civil-date";

export type SavingsPlanReportCheckIn = {
  status: string;
  expectedAmount: string;
  periodStart: Date;
  periodEnd: Date;
  contributionAmount: string | null;
};

export type SavingsPlanReportInput = {
  planName: string;
  targetAmount: string;
  targetDateIso: string | null;
  plannedWeeklyContribution: string;
  contributionWeekday: number;
  year: number;
  month: number;
  asOf: Date;
  checkIns: readonly SavingsPlanReportCheckIn[];
  contributionsInMonth: readonly { amount: string; contributedAt: Date }[];
  budgetLines: readonly BudgetLineSnapshot[];
  withdrawalsInMonth: readonly {
    amount: string;
    occurredAt: Date;
    description: string | null;
  }[];
  allContributionAmounts: readonly string[];
};

export type SavingsPlanReportSection = {
  planName: string;
  targetAmount: string;
  targetDateIso: string | null;
  plannedInMonth: string;
  recordedInMonth: string;
  checkInsExpected: number;
  checkInsCompleted: number;
  checkInsMissed: number;
  complianceRatePercent: string;
  budgetExecution: { categoryName: string; limit: string; spent: string; utilizationPercent: number | null }[];
  withdrawalsInMonth: { dateIso: string; amount: string; description: string | null }[];
  contributedTotal: string;
  amountRemaining: string;
  weeksRemaining: number;
  projectionNote: string;
};

export function buildSavingsPlanReportSection(input: SavingsPlanReportInput): SavingsPlanReportSection {
  const checkInsInMonth = input.checkIns.filter((c) =>
    isInstantInCivilMonth(c.periodStart, input.year, input.month),
  );
  const expected = checkInsInMonth.length;
  const completed = checkInsInMonth.filter((c) => c.status === "COMPLETED").length;
  const missed = checkInsInMonth.filter((c) => c.status === "MISSED").length;
  const recordedInMonth = input.contributionsInMonth
    .reduce((s, c) => s.plus(c.amount), decimal(0))
    .toFixed(2);
  const plannedInMonth = checkInsInMonth
    .reduce((s, c) => s.plus(c.expectedAmount), decimal(0))
    .toFixed(2);

  const compliance =
    expected > 0
      ? decimal(completed).div(expected).times(100).toDecimalPlaces(2).toFixed(2)
      : "0.00";

  const progress = computePlanProgress({
    targetAmount: input.targetAmount,
    contributionAmounts: input.allContributionAmounts,
    targetDateIso: input.targetDateIso,
    asOf: input.asOf,
  });

  const today = civilDateFromInstant(input.asOf);
  const weeksLeft = input.targetDateIso
    ? weeksRemaining(today, parseTarget(input.targetDateIso), input.contributionWeekday)
    : 0;

  let projectionNote = "Ritmo mensal comparado com contribuições confirmadas (sem valores fictícios).";
  if (progress.targetReached) {
    projectionNote = "Objectivo concluído com base nas contribuições registadas.";
  } else if (decimal(recordedInMonth).lt(plannedInMonth)) {
    projectionNote = `Registado ${recordedInMonth} € vs. planeado ${plannedInMonth} € no mês.`;
  }

  return {
    planName: input.planName,
    targetAmount: input.targetAmount,
    targetDateIso: input.targetDateIso,
    plannedInMonth,
    recordedInMonth,
    checkInsExpected: expected,
    checkInsCompleted: completed,
    checkInsMissed: missed,
    complianceRatePercent: compliance,
    budgetExecution: input.budgetLines.map((line) => ({
      categoryName: line.categoryName,
      limit: line.limitAmount,
      spent: line.spentAmount,
      utilizationPercent: budgetUtilizationPercent(line.limitAmount, line.spentAmount),
    })),
    withdrawalsInMonth: input.withdrawalsInMonth.map((w) => ({
      dateIso: formatCivilDateIso(civilDateFromInstant(w.occurredAt)),
      amount: w.amount,
      description: w.description,
    })),
    contributedTotal: progress.contributed,
    amountRemaining: progress.amountRemaining,
    weeksRemaining: weeksLeft,
    projectionNote,
  };
}

function parseTarget(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y!, month: m!, day: d! };
}

export function formatSavingsPlanReportCsvBlock(section: SavingsPlanReportSection): string {
  const lines = [
    "",
    "Plano de Poupança",
    `"Plano","${section.planName.replace(/"/g, '""')}"`,
    `"Objectivo","${section.targetAmount}"`,
    `"Data-alvo","${section.targetDateIso ?? ""}"`,
    `"Planeado no mês","${section.plannedInMonth}"`,
    `"Registado no mês","${section.recordedInMonth}"`,
    `"Check-ins esperados","${section.checkInsExpected}"`,
    `"Check-ins concluídos","${section.checkInsCompleted}"`,
    `"Check-ins em falta","${section.checkInsMissed}"`,
    `"Taxa cumprimento %","${section.complianceRatePercent}"`,
    `"Acumulado","${section.contributedTotal}"`,
    `"Em falta","${section.amountRemaining}"`,
    `"Semanas restantes","${section.weeksRemaining}"`,
    `"Projeção","${section.projectionNote.replace(/"/g, '""')}"`,
  ];
  for (const row of section.budgetExecution) {
    lines.push(
      `"Orçamento ${row.categoryName}","limite ${row.limit}","gasto ${row.spent}","utilização ${row.utilizationPercent ?? "n/a"}%"`,
    );
  }
  for (const w of section.withdrawalsInMonth) {
    lines.push(
      `"Saída poupança","${w.dateIso}","${w.amount}","${(w.description ?? "").replace(/"/g, '""')}"`,
    );
  }
  return lines.join("\n");
}

type ReportPdfDoc = {
  addPage(): void;
  fontSize(size: number): ReportPdfDoc;
  text(text: string, options?: Record<string, unknown>): ReportPdfDoc;
  moveDown(lines?: number): ReportPdfDoc;
};

export function appendSavingsPlanReportPdf(doc: ReportPdfDoc, section: SavingsPlanReportSection): void {
  doc.addPage();
  doc.fontSize(14).text("Plano de Poupança", { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(10);
  doc.text(`Plano: ${section.planName}`);
  doc.text(`Objectivo: ${section.targetAmount} € até ${section.targetDateIso ?? "—"}`);
  doc.text(`Planeado no mês: ${section.plannedInMonth} € · Registado: ${section.recordedInMonth} €`);
  doc.text(
    `Check-ins: ${section.checkInsCompleted}/${section.checkInsExpected} concluídos, ${section.checkInsMissed} em falta (${section.complianceRatePercent}% cumprimento)`,
  );
  doc.text(`Acumulado: ${section.contributedTotal} € · Em falta: ${section.amountRemaining} €`);
  doc.text(`Semanas restantes: ${section.weeksRemaining}`);
  doc.text(section.projectionNote);
  doc.moveDown();
  doc.text("Execução orçamentos do plano:", { underline: true });
  for (const row of section.budgetExecution) {
    doc.text(
      `${row.categoryName}: ${row.spent} / ${row.limit} € (${row.utilizationPercent ?? "n/a"}%)`,
    );
  }
  if (section.withdrawalsInMonth.length > 0) {
    doc.moveDown();
    doc.text("Saídas da conta protegida:", { underline: true });
    for (const w of section.withdrawalsInMonth) {
      doc.text(`${w.dateIso}: ${w.amount} € — ${w.description ?? ""}`);
    }
  }
}
