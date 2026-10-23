import { decimal } from "@/lib/finance/money";

export const ANOMALY_FIRST_EXPENSE_MIN_EUR = "150.00";
export const ANOMALY_MOM_SPIKE_RATIO = 1.5;
export const ANOMALY_MEDIAN_MULTIPLIER = 3;

export type ExpenseAnomalyHit = {
  ruleId: "R1_median_3x" | "R2_first_high" | "R3_mom_spike";
  title: string;
  description: string;
  evidence: string[];
  categoryId?: string;
  transactionId?: string;
  severity: "ATTENTION" | "INFORMATION";
};

function median(values: readonly string[]): string | null {
  if (values.length === 0) return null;
  const sorted = [...values].map((v) => decimal(v).abs()).sort((a, b) => a.cmp(b));
  return sorted[Math.floor(sorted.length / 2)]!.toFixed(2);
}

export function detectCategoryMedian3xAnomaly(input: {
  categoryId: string;
  categoryName: string;
  monthTotal: string;
  historyTotals: readonly string[];
}): ExpenseAnomalyHit | null {
  if (input.historyTotals.length < 5) return null;
  const med = median(input.historyTotals);
  if (!med || decimal(med).lte(0)) return null;
  const threshold = decimal(med).times(ANOMALY_MEDIAN_MULTIPLIER);
  if (decimal(input.monthTotal).lte(threshold)) return null;
  return {
    ruleId: "R1_median_3x",
    categoryId: input.categoryId,
    title: `Despesa atípica: ${input.categoryName}`,
    description: `O total do mês (${input.monthTotal} €) excede ${ANOMALY_MEDIAN_MULTIPLIER}× a mediana histórica (${med} €) nesta categoria.`,
    evidence: [`Total do mês: ${input.monthTotal} €`, `Mediana (${input.historyTotals.length} meses): ${med} €`],
    severity: "ATTENTION",
  };
}

export function detectFirstHighExpenseAnomaly(input: {
  transactionId: string;
  categoryName: string;
  amount: string;
  priorCountInCategory: number;
}): ExpenseAnomalyHit | null {
  if (input.priorCountInCategory > 0) return null;
  if (decimal(input.amount).abs().lte(ANOMALY_FIRST_EXPENSE_MIN_EUR)) return null;
  return {
    ruleId: "R2_first_high",
    transactionId: input.transactionId,
    title: `Primeira despesa elevada: ${input.categoryName}`,
    description: `Primeiro movimento registado nesta categoria acima de ${ANOMALY_FIRST_EXPENSE_MIN_EUR} €.`,
    evidence: [`Montante: ${decimal(input.amount).abs().toFixed(2)} €`],
    severity: "ATTENTION",
  };
}

export function detectMonthOverMonthSpike(input: {
  categoryId: string;
  categoryName: string;
  currentTotal: string;
  previousTotal: string;
}): ExpenseAnomalyHit | null {
  const prev = decimal(input.previousTotal).abs();
  const curr = decimal(input.currentTotal).abs();
  if (prev.lte(0)) return null;
  if (curr.lte(prev.times(ANOMALY_MOM_SPIKE_RATIO))) return null;
  return {
    ruleId: "R3_mom_spike",
    categoryId: input.categoryId,
    title: `Subida forte: ${input.categoryName}`,
    description: `Despesas desta categoria subiram mais de ${Math.round((ANOMALY_MOM_SPIKE_RATIO - 1) * 100)}% face ao mês anterior.`,
    evidence: [
      `Mês anterior: ${prev.toFixed(2)} €`,
      `Mês actual: ${curr.toFixed(2)} €`,
    ],
    severity: "ATTENTION",
  };
}
