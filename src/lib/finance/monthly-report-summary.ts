import { z } from "zod";
import { decimal } from "@/lib/finance/money";
import { formatEUR } from "@/lib/finance/money";

export const MONTHLY_REPORT_PROMPT_VERSION = "2026-10-21";

const moneyString = z.string().regex(/^-?\d+\.\d{2}$/);

export const monthlyReportFactsSchema = z.object({
  period: z.string().min(7).max(10),
  periodLabel: z.string().min(3).max(120),
  income: moneyString,
  expenses: moneyString,
  net: moneyString,
  savingsRate: z.string().regex(/^-?\d+\.\d{2}$/),
  previousMonth: z
    .object({
      income: moneyString,
      expenses: moneyString,
      net: moneyString,
      incomeChangePercent: z.number().nullable(),
      expensesChangePercent: z.number().nullable(),
    })
    .nullable(),
  topCategories: z.array(
    z.object({
      name: z.string().min(1).max(80),
      amount: moneyString,
      sharePercent: z.string().regex(/^\d+\.\d{2}$/),
    }),
  ),
  budgetExecution: z
    .object({
      hasBudget: z.boolean(),
      linesOverLimit: z.number().int().min(0),
      topPressure: z
        .object({
          categoryName: z.string(),
          utilizationPercent: z.number().nullable(),
        })
        .nullable(),
    })
    .nullable(),
  goalsHighlight: z
    .object({
      name: z.string(),
      progressPercent: z.number().nullable(),
    })
    .nullable(),
  activeAlertsCount: z.number().int().min(0),
  atypicalExpenses: z.array(
    z.object({
      description: z.string(),
      amount: moneyString,
      categoryName: z.string().nullable(),
    }),
  ),
  upcomingCommitments: z.array(
    z.object({
      label: z.string(),
      dueDate: z.string(),
      amount: moneyString.nullable(),
    }),
  ),
  dataQuality: z.object({
    monthsAvailable: z.number().int().min(0),
    missingCategories: z.number().int().min(0),
    movementCount: z.number().int().min(0),
  }),
  limitations: z.array(z.string().max(240)),
});

export type MonthlyReportFacts = z.infer<typeof monthlyReportFactsSchema>;

export function computeSavingsRate(income: string, net: string): string {
  const inc = decimal(income);
  if (!inc.gt(0)) return "0.00";
  return decimal(net).div(inc).times(100).toDecimalPlaces(2).toFixed(2);
}

export function buildDeterministicMonthlyNarrative(facts: MonthlyReportFacts): string {
  const parts: string[] = [];

  parts.push(
    `No período ${facts.periodLabel}, as receitas totalizaram ${formatEUR(facts.income)} e as despesas ${formatEUR(facts.expenses)}, resultando num saldo de ${formatEUR(facts.net)}.`,
  );

  if (facts.topCategories.length > 0) {
    const top = facts.topCategories
      .slice(0, 3)
      .map((c) => `${c.name} (${formatEUR(c.amount)})`)
      .join(", ");
    parts.push(`As principais categorias de despesa foram: ${top}.`);
  } else {
    parts.push("Não houve despesas concluídas categorizadas neste período.");
  }

  if (facts.previousMonth) {
    const inc = facts.previousMonth.incomeChangePercent;
    const exp = facts.previousMonth.expensesChangePercent;
    if (inc == null && exp == null) {
      parts.push("Não há base comparável fiável face ao mês anterior.");
    } else {
      const bits: string[] = [];
      if (inc != null) bits.push(`receitas ${inc >= 0 ? "+" : ""}${inc.toLocaleString("pt-PT")}%`);
      if (exp != null) bits.push(`despesas ${exp >= 0 ? "+" : ""}${exp.toLocaleString("pt-PT")}%`);
      parts.push(`Face ao mês anterior: ${bits.join("; ")}.`);
    }
  }

  if (facts.budgetExecution?.hasBudget) {
    if (facts.budgetExecution.linesOverLimit > 0) {
      parts.push(
        `${facts.budgetExecution.linesOverLimit} linha(s) orçamental(is) ultrapassaram o limite definido.`,
      );
    } else {
      parts.push("Nenhuma linha orçamental ultrapassou o limite definido.");
    }
  }

  if (facts.goalsHighlight?.name) {
    parts.push(
      `Objetivo em destaque: «${facts.goalsHighlight.name}»${facts.goalsHighlight.progressPercent != null ? ` (${facts.goalsHighlight.progressPercent.toLocaleString("pt-PT")}% do alvo)` : ""}.`,
    );
  }

  if (facts.activeAlertsCount > 0) {
    parts.push(`Existem ${facts.activeAlertsCount} alerta(s) financeiro(s) ativo(s) neste workspace.`);
  }

  if (facts.atypicalExpenses.length > 0) {
    const sample = facts.atypicalExpenses[0]!;
    parts.push(
      `Despesa atípica detetada: ${sample.description} (${formatEUR(sample.amount)}).`,
    );
  }

  if (facts.upcomingCommitments.length > 0) {
    parts.push(
      `Próximos compromissos conhecidos: ${facts.upcomingCommitments
        .slice(0, 3)
        .map((c) => `${c.label} (${c.dueDate})`)
        .join("; ")}.`,
    );
  }

  for (const note of facts.limitations) {
    parts.push(note);
  }

  if (facts.dataQuality.monthsAvailable < 3) {
    parts.push("Não existem dados suficientes para estabelecer uma tendência de longo prazo.");
  }

  return parts.join(" ");
}

const narrativeSchema = z.object({
  narrative: z.string().min(20).max(2000),
});

export type MonthlyReportNarrativeModelOutput = z.infer<typeof narrativeSchema>;

export function parseMonthlyReportNarrativeModel(json: unknown): MonthlyReportNarrativeModelOutput {
  return narrativeSchema.parse(json);
}

/** Garante que montantes-chave do JSON aparecem no texto (anti-alucinação básica). */
export function narrativeMatchesFacts(
  narrative: string,
  facts: MonthlyReportFacts,
): boolean {
  const required = [facts.income, facts.expenses, facts.net];
  const normalized = narrative.replace(/\s/g, "");
  return required.every((amount) => {
    const eur = formatEUR(amount).replace(/\s/g, "");
    const plain = amount.replace(".", ",");
    return normalized.includes(amount) || normalized.includes(eur) || narrative.includes(plain);
  });
}
