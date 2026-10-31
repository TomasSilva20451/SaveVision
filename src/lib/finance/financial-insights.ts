import { isInstantInCivilMonth } from "@/lib/datetime/civil-date";
import {
  budgetOverage,
  budgetUtilizationPercent,
  type BudgetLineSnapshot,
} from "@/lib/finance/budget";
import {
  detectCategoryMedian3xAnomaly,
  detectFirstHighExpenseAnomaly,
  detectMonthOverMonthSpike,
} from "@/lib/finance/expense-anomaly-detection";
import { safePercentChange } from "@/lib/finance/kpi";
import { addMoney, decimal } from "@/lib/finance/money";
export type InsightRecurringFrequency =
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "SEMIANNUAL"
  | "YEARLY"
  | "CUSTOM"
  | "ONE_OFF";

export type InsightSeverity = "INFORMATION" | "POSITIVE" | "ATTENTION" | "WARNING";

export type FinancialInsight = {
  id: string;
  type: string;
  severity: InsightSeverity;
  title: string;
  description: string;
  periodLabel?: string;
  triggerMetric?: string;
  evidence: string[];
  suggestedAction?: string;
  limitations?: string;
  linkHref?: string;
};

export type ExpenseMovementSnapshot = {
  id?: string;
  occurredAt: Date;
  amount: string;
  categoryId: string;
  categoryName: string;
};

export type RecurringSubscriptionSnapshot = {
  id: string;
  name: string;
  expectedAmount: string;
  frequency: InsightRecurringFrequency;
  status: string;
};

export type FinancialInsightsInput = {
  workspaceId: string;
  civilYear: number;
  civilMonth: number;
  expenseMovements: readonly ExpenseMovementSnapshot[];
  incomeMonth: string;
  incomePreviousMonth: string;
  expenseMonth: string;
  expensePreviousMonth: string;
  economicResultMonth: string;
  budgetLines: readonly BudgetLineSnapshot[];
  subscriptions: readonly RecurringSubscriptionSnapshot[];
  upcomingWeekOutflows: string;
  savingsRateCurrent: number | null;
  savingsRatePrevious: number | null;
};

export function analysisSavingsRate(income: string, economicResult: string): number | null {
  if (decimal(income).lte(0)) return null;
  return decimal(economicResult).div(income).times(100).toDecimalPlaces(1).toNumber();
}

export function averageDailyExpense(expense: string, observedDays: number): string {
  if (!Number.isInteger(observedDays) || observedDays <= 0) {
    throw new Error("INVALID_OBSERVED_DAYS");
  }
  return decimal(expense).div(observedDays).toFixed(2);
}

export function essentialityRatio(essentialExpense: string, totalExpense: string): number | null {
  if (decimal(totalExpense).lte(0)) return null;
  return decimal(essentialExpense).div(totalExpense).times(100).toDecimalPlaces(1).toNumber();
}

export function budgetCompliancePercent(
  lines: readonly { limitAmount: string; spentAmount: string }[],
): number | null {
  if (lines.length === 0) return null;
  const compliant = lines.filter((line) => decimal(line.spentAmount).lte(line.limitAmount)).length;
  return decimal(compliant).div(lines.length).times(100).toDecimalPlaces(1).toNumber();
}

export function medianAmount(values: readonly string[]): string | null {
  if (values.length === 0) return null;
  const sorted = [...values].map((v) => decimal(v)).sort((a, b) => a.comparedTo(b));
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid]!.toFixed(2);
  }
  return sorted[mid - 1]!.plus(sorted[mid]!).div(2).toFixed(2);
}

export function medianAbsoluteDeviation(
  values: readonly string[],
  med: string,
): string | null {
  if (values.length === 0) return null;
  const m = decimal(med);
  const deviations = values.map((v) => decimal(v).minus(m).abs());
  return medianAmount(deviations.map((d) => d.toFixed(2)));
}

export function sumCategoryExpensesInMonth(
  movements: readonly ExpenseMovementSnapshot[],
  year: number,
  month: number,
): Map<string, { categoryName: string; total: string }> {
  const map = new Map<string, { categoryName: string; total: string }>();
  for (const row of movements) {
    if (!isInstantInCivilMonth(row.occurredAt, year, month)) continue;
    const abs = decimal(row.amount).abs();
    const prev = map.get(row.categoryId);
    if (!prev) {
      map.set(row.categoryId, {
        categoryName: row.categoryName,
        total: abs.toFixed(2),
      });
    } else {
      map.set(row.categoryId, {
        categoryName: prev.categoryName,
        total: decimal(prev.total).plus(abs).toFixed(2),
      });
    }
  }
  return map;
}

export function categoryTotalsForMonth(
  movements: readonly ExpenseMovementSnapshot[],
  year: number,
  month: number,
): { categoryId: string; categoryName: string; amount: string }[] {
  const map = sumCategoryExpensesInMonth(movements, year, month);
  return [...map.entries()]
    .map(([categoryId, row]) => ({
      categoryId,
      categoryName: row.categoryName,
      amount: row.total,
    }))
    .sort((a, b) => decimal(b.amount).comparedTo(a.amount));
}

export function hasThreeMonthIncreasingTrend(amounts: readonly string[]): boolean {
  if (amounts.length < 3) return false;
  for (let i = amounts.length - 3; i < amounts.length - 1; i += 1) {
    if (!decimal(amounts[i + 1]!).gt(amounts[i]!)) return false;
  }
  return true;
}

export function buildCategoryMonthSeries(
  movements: readonly ExpenseMovementSnapshot[],
  categoryId: string,
  months: readonly { year: number; month: number }[],
): string[] {
  return months.map(({ year, month }) => {
    const map = sumCategoryExpensesInMonth(movements, year, month);
    return map.get(categoryId)?.total ?? "0.00";
  });
}

export function computeConcentration(
  lines: readonly { categoryName: string; amount: string }[],
): {
  ranked: { categoryName: string; amount: string; sharePercent: number | null }[];
  top3SharePercent: number | null;
  total: string;
} {
  const total = lines.reduce(
    (sum, line) => sum.plus(line.amount),
    decimal(0),
  );
  const ranked = lines
    .map((line) => ({
      categoryName: line.categoryName,
      amount: line.amount,
      sharePercent:
        total.lte(0) ? null : decimal(line.amount).div(total).times(100).toDecimalPlaces(1).toNumber(),
    }))
    .sort((a, b) => decimal(b.amount).comparedTo(a.amount));

  const top3 = ranked.slice(0, 3);
  const top3SharePercent =
    total.lte(0)
      ? null
      : top3
          .reduce((s, l) => s.plus(l.amount), decimal(0))
          .div(total)
          .times(100)
          .toDecimalPlaces(1)
          .toNumber();

  return { ranked, top3SharePercent, total: total.toFixed(2) };
}

export function recurringMonthlyEquivalent(
  amount: string,
  frequency: InsightRecurringFrequency,
): string {
  const base = decimal(amount);
  if (frequency === "CUSTOM" || frequency === "ONE_OFF") return base.toFixed(2);
  switch (frequency) {
    case "WEEKLY":
      return base.times(52).div(12).toFixed(2);
    case "BIWEEKLY":
      return base.times(26).div(12).toFixed(2);
    case "MONTHLY":
      return base.toFixed(2);
    case "QUARTERLY":
      return base.div(3).toFixed(2);
    case "SEMIANNUAL":
      return base.div(6).toFixed(2);
    case "YEARLY":
      return base.div(12).toFixed(2);
    default:
      return base.toFixed(2);
  }
}

export function recurringAnnualEquivalent(monthlyEq: string): string {
  return decimal(monthlyEq).times(12).toFixed(2);
}

export function detectExpenseAnomaly(
  amount: string,
  history: readonly string[],
): { flagged: boolean; message?: string } {
  if (history.length < 5) {
    return { flagged: false };
  }
  const med = medianAmount(history);
  if (!med) return { flagged: false };
  const mad = medianAbsoluteDeviation(history, med);
  if (!mad || decimal(mad).lte(0)) return { flagged: false };
  const threshold = decimal(med).plus(decimal(mad).times(2));
  if (decimal(amount).gt(threshold)) {
    return {
      flagged: true,
      message:
        "Esta despesa é superior ao padrão habitual desta categoria (mediana + 2×desvio absoluto mediano).",
    };
  }
  return { flagged: false };
}

function monthLabel(year: number, month: number): string {
  return `${month.toString().padStart(2, "0")}/${year}`;
}

function offsetMonth(year: number, month: number, delta: number): { year: number; month: number } {
  let m = month + delta;
  let y = year;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  return { year: y, month: m };
}

export function buildFinancialInsights(input: FinancialInsightsInput): {
  summary: {
    expenseMonth: string;
    expenseChangePercent: number | null;
    incomeMonth: string;
    incomeChangePercent: number | null;
    economicResultMonth: string;
    subscriptionMonthlyTotal: string;
    subscriptionAnnualEquivalent: string;
    upcomingWeekOutflows: string;
    topConcentrationPercent: number | null;
  };
  insights: FinancialInsight[];
} {
  const insights: FinancialInsight[] = [];
  const expenseChange = safePercentChange(input.expenseMonth, input.expensePreviousMonth);
  const incomeChange = safePercentChange(input.incomeMonth, input.incomePreviousMonth);

  if (expenseChange != null && expenseChange > 5) {
    insights.push({
      id: "expense-month-up",
      type: "TREND",
      severity: "ATTENTION",
      title: "Despesas acima do mês anterior",
      description: `As despesas realizadas aumentaram ${expenseChange.toFixed(1)}% face ao mês anterior.`,
      periodLabel: monthLabel(input.civilYear, input.civilMonth),
      triggerMetric: "expenseMonthChangePercent",
      evidence: [
        `Mês anterior: ${input.expensePreviousMonth} €`,
        `Mês actual: ${input.expenseMonth} €`,
      ],
      suggestedAction: "Rever movimentos recentes nas categorias com maior peso.",
      linkHref: "/despesas",
    });
  }

  const monthTotals = categoryTotalsForMonth(
    input.expenseMovements,
    input.civilYear,
    input.civilMonth,
  );
  const concentration = computeConcentration(
    monthTotals.map((r) => ({ categoryName: r.categoryName, amount: r.amount })),
  );

  if (concentration.top3SharePercent != null && concentration.top3SharePercent >= 50) {
    const names = concentration.ranked
      .slice(0, 3)
      .map((r) => r.categoryName)
      .join(", ");
    insights.push({
      id: "concentration-top3",
      type: "CONCENTRATION",
      severity: "INFORMATION",
      title: "Concentração de despesas",
      description: `${names} representam ${concentration.top3SharePercent.toFixed(1)}% das despesas realizadas neste mês.`,
      periodLabel: monthLabel(input.civilYear, input.civilMonth),
      triggerMetric: "top3SharePercent",
      evidence: concentration.ranked.slice(0, 3).map((r) => `${r.categoryName}: ${r.amount} €`),
      linkHref: "/analises",
    });
  }

  const trendMonths = [0, -1, -2].map((d) =>
    offsetMonth(input.civilYear, input.civilMonth, d),
  );
  for (const cat of monthTotals.slice(0, 8)) {
    const series = buildCategoryMonthSeries(input.expenseMovements, cat.categoryId, trendMonths);
    if (hasThreeMonthIncreasingTrend(series)) {
      insights.push({
        id: `trend-up-${cat.categoryId}`,
        type: "CATEGORY_TREND",
        severity: "ATTENTION",
        title: `Despesas de ${cat.categoryName} em crescimento`,
        description: `A categoria aumentou durante três meses consecutivos.`,
        periodLabel: trendMonths.map((m) => monthLabel(m.year, m.month)).join(" → "),
        triggerMetric: "threeMonthIncrease",
        evidence: series.map((v, i) => `${monthLabel(trendMonths[i]!.year, trendMonths[i]!.month)}: ${v} €`),
        suggestedAction:
          "Rever os movimentos desta categoria e avaliar se o orçamento continua adequado.",
        linkHref: "/despesas",
      });
    }
  }

  for (const line of input.budgetLines) {
    const over = budgetOverage(line.limitAmount, line.spentAmount);
    if (decimal(over).gt(0)) {
      const util = budgetUtilizationPercent(line.limitAmount, line.spentAmount);
      insights.push({
        id: `budget-over-${line.categoryId}`,
        type: "BUDGET",
        severity: "WARNING",
        title: `Orçamento excedido: ${line.categoryName}`,
        description: `A categoria excedeu o orçamento mensal em ${over} €${util != null ? ` (${util.toFixed(1)}%).` : "."}`,
        periodLabel: monthLabel(input.civilYear, input.civilMonth),
        triggerMetric: "budgetOverage",
        evidence: [
          `Limite: ${line.limitAmount} €`,
          `Gasto: ${line.spentAmount} €`,
        ],
        suggestedAction: "Ajustar o orçamento ou reduzir despesas nesta categoria.",
        linkHref: "/orcamentos",
      });
    }
  }

  const activeSubs = input.subscriptions.filter((s) => s.status === "ACTIVE");
  const monthlyEq = activeSubs.map((s) =>
    recurringMonthlyEquivalent(s.expectedAmount, s.frequency),
  );
  const subscriptionMonthlyTotal = addMoney(monthlyEq).toFixed(2);
  const subscriptionAnnualEquivalent = recurringAnnualEquivalent(subscriptionMonthlyTotal);

  if (activeSubs.length > 0) {
    insights.push({
      id: "subscriptions-total",
      type: "SUBSCRIPTIONS",
      severity: "INFORMATION",
      title: "Compromissos recorrentes",
      description: `As despesas recorrentes activas representam cerca de ${subscriptionAnnualEquivalent} € por ano (equivalente mensal ${subscriptionMonthlyTotal} €).`,
      triggerMetric: "subscriptionAnnualEquivalent",
      evidence: activeSubs.slice(0, 5).map(
        (s) => `${s.name}: ${recurringMonthlyEquivalent(s.expectedAmount, s.frequency)} €/mês eq.`,
      ),
      limitations: "Equivalente calculado; não representa dinheiro já gasto.",
      linkHref: "/despesas-recorrentes",
    });
  }

  if (decimal(input.upcomingWeekOutflows).gt(0)) {
    insights.push({
      id: "upcoming-week-outflows",
      type: "FORECAST",
      severity: "INFORMATION",
      title: "Pagamentos previstos (7 dias)",
      description: `Existem ${input.upcomingWeekOutflows} € de saídas previstas nos próximos sete dias (movimentos conhecidos).`,
      triggerMetric: "upcomingWeekOutflows",
      evidence: ["Inclui receitas/despesas previstas registadas; ver /previsoes."],
      limitations: "Não inclui obrigações não registadas.",
      linkHref: "/previsoes",
    });
  }

  if (
    input.savingsRateCurrent != null &&
    input.savingsRatePrevious != null &&
    input.savingsRateCurrent < input.savingsRatePrevious - 1
  ) {
    insights.push({
      id: "savings-rate-down",
      type: "HEALTH",
      severity: "ATTENTION",
      title: "Taxa de poupança em queda",
      description: "A taxa de poupança estimada diminuiu face ao mês anterior.",
      triggerMetric: "savingsRate",
      evidence: [
        `Mês anterior: ${input.savingsRatePrevious.toFixed(1)}%`,
        `Mês actual: ${input.savingsRateCurrent.toFixed(1)}%`,
      ],
      linkHref: "/plano",
    });
  }

  const historyMonths = [-5, -4, -3, -2, -1].map((d) =>
    offsetMonth(input.civilYear, input.civilMonth, d),
  );

  const anomalyHits = [];
  for (const cat of monthTotals.slice(0, 10)) {
    const history = historyMonths.map((m) => {
      const totals = sumCategoryExpensesInMonth(input.expenseMovements, m.year, m.month);
      return totals.get(cat.categoryId)?.total ?? "0.00";
    });
    const prevMonth = offsetMonth(input.civilYear, input.civilMonth, -1);
    const prevTotals = sumCategoryExpensesInMonth(
      input.expenseMovements,
      prevMonth.year,
      prevMonth.month,
    );
    const prevTotal = prevTotals.get(cat.categoryId)?.total ?? "0.00";

    const r1 = detectCategoryMedian3xAnomaly({
      categoryId: cat.categoryId,
      categoryName: cat.categoryName,
      monthTotal: cat.amount,
      historyTotals: history,
    });
    if (r1) anomalyHits.push(r1);

    const r3 = detectMonthOverMonthSpike({
      categoryId: cat.categoryId,
      categoryName: cat.categoryName,
      currentTotal: cat.amount,
      previousTotal: prevTotal,
    });
    if (r3) anomalyHits.push(r3);
  }

  const currentMonthMoves = input.expenseMovements.filter((m) =>
    isInstantInCivilMonth(m.occurredAt, input.civilYear, input.civilMonth),
  );
  for (const move of currentMonthMoves) {
    if (!move.id) continue;
    const prior = input.expenseMovements.filter(
      (m) => m.categoryId === move.categoryId && m.occurredAt < move.occurredAt,
    ).length;
    const r2 = detectFirstHighExpenseAnomaly({
      transactionId: move.id,
      categoryName: move.categoryName,
      amount: move.amount,
      priorCountInCategory: prior,
    });
    if (r2) anomalyHits.push(r2);
  }

  const priority = { R2_first_high: 0, R3_mom_spike: 1, R1_median_3x: 2 };
  anomalyHits
    .sort((a, b) => priority[a.ruleId] - priority[b.ruleId])
    .slice(0, 3)
    .forEach((hit) => {
      insights.push({
        id: hit.transactionId
          ? `anomaly-${hit.ruleId}-${hit.transactionId}`
          : `anomaly-${hit.ruleId}-${hit.categoryId}`,
        type: "ANOMALY",
        severity: hit.severity,
        title: hit.title,
        description: hit.description,
        periodLabel: monthLabel(input.civilYear, input.civilMonth),
        triggerMetric: hit.ruleId,
        evidence: hit.evidence,
        limitations: "Regra determinística; não implica erro ou fraude.",
        linkHref: "/despesas",
      });
    });

  if (insights.length === 0) {
    insights.push({
      id: "insufficient-data",
      type: "DATA_QUALITY",
      severity: "INFORMATION",
      title: "Dados limitados",
      description:
        "Ainda não há informação suficiente para tendências ou anomalias fiáveis neste workspace.",
      evidence: [],
      limitations: "Regista mais movimentos ou aguarda mais meses de histórico.",
    });
  }

  return {
    summary: {
      expenseMonth: input.expenseMonth,
      expenseChangePercent: expenseChange,
      incomeMonth: input.incomeMonth,
      incomeChangePercent: incomeChange,
      economicResultMonth: input.economicResultMonth,
      subscriptionMonthlyTotal,
      subscriptionAnnualEquivalent,
      upcomingWeekOutflows: input.upcomingWeekOutflows,
      topConcentrationPercent: concentration.top3SharePercent,
    },
    insights,
  };
}

export function pickTopInsights(
  insights: readonly FinancialInsight[],
  limit: number,
): FinancialInsight[] {
  const weight: Record<InsightSeverity, number> = {
    WARNING: 4,
    ATTENTION: 3,
    INFORMATION: 2,
    POSITIVE: 1,
  };
  return [...insights]
    .sort((a, b) => weight[b.severity] - weight[a.severity])
    .slice(0, limit);
}
