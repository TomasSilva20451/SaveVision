import "server-only";

import {
  civilDateFromInstant,
  formatCivilDateIso,
  isInstantInCivilMonth,
  startOfNextCivilMonth,
} from "@/lib/datetime/civil-date";
import {
  calculateCashFlow,
  calculateExpenses,
  calculateIncome,
} from "@/lib/finance/aggregates";
import type { AssistantPeriod, ValidatedAssistantIntent } from "@/lib/finance/financial-assistant-intents";
import {
  matchCategoryByName,
  parseAssistantPeriodDefault,
} from "@/lib/finance/financial-assistant-intents";
import { decimal, formatEUR, normalizeDecimalInput } from "@/lib/finance/money";
import type { LedgerMovement } from "@/lib/finance/types";
import { db } from "@/lib/db";
import { listAccountsWithBalances } from "@/server/services/accounts";
import {
  collectTreasuryForecastEvents,
} from "@/server/services/treasury-forecast";
import {
  treasuryHorizonEnd,
  treasuryHorizonStart,
} from "@/lib/finance/treasury-forecast";
import { getPlanningOverview } from "@/server/services/planning";

export const ASSISTANT_MAX_EVIDENCE_TX = 8;
export const ASSISTANT_MAX_DESCRIPTION_LEN = 72;

export type AssistantLink = { label: string; href: string };

export type AssistantToolResult = {
  summaryKey: string;
  facts: Record<string, string | number | boolean>;
  evidence: string[];
  links: AssistantLink[];
  dataIncomplete?: boolean;
};

function truncateDescription(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= ASSISTANT_MAX_DESCRIPTION_LEN) return trimmed;
  return `${trimmed.slice(0, ASSISTANT_MAX_DESCRIPTION_LEN - 1)}…`;
}

function toMovement(tx: {
  accountId: string;
  type: string;
  status: string;
  amount: { toString(): string };
  deletedAt: Date | null;
}): LedgerMovement {
  return {
    accountId: tx.accountId,
    type: tx.type as LedgerMovement["type"],
    status: tx.status as LedgerMovement["status"],
    amount: tx.amount.toString(),
    deletedAt: tx.deletedAt,
  };
}

type MonthRef = { year: number; month: number };

function parseYearMonth(yearMonth: string): MonthRef {
  const [y, m] = yearMonth.split("-").map(Number);
  return { year: y, month: m };
}

function monthsBack(from: MonthRef, count: number): MonthRef[] {
  const out: MonthRef[] = [];
  let y = from.year;
  let m = from.month;
  for (let i = 0; i < count; i += 1) {
    out.unshift({ year: y, month: m });
    m -= 1;
    if (m <= 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

function periodToMonths(period: AssistantPeriod, today: MonthRef): MonthRef[] {
  if (period.kind === "month") {
    return [parseYearMonth(period.yearMonth)];
  }
  return monthsBack(today, period.count);
}

function periodLabel(period: AssistantPeriod, today: MonthRef): string {
  if (period.kind === "month") return period.yearMonth;
  return `últimos ${period.count} meses (até ${today.year}-${String(today.month).padStart(2, "0")})`;
}

function transacoesLink(params: Record<string, string>): AssistantLink {
  const query = new URLSearchParams(params);
  return { label: "Ver transações", href: `/transacoes?${query.toString()}` };
}

async function loadCompletedExpenses(workspaceId: string) {
  return db.transaction.findMany({
    where: { workspaceId, deletedAt: null, type: "EXPENSE", status: "COMPLETED" },
    include: { category: true },
    orderBy: { occurredAt: "desc" },
    take: 5000,
  });
}

async function loadCompletedIncomeExpense(workspaceId: string) {
  return db.transaction.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      status: "COMPLETED",
      type: { in: ["INCOME", "EXPENSE"] },
    },
    orderBy: { occurredAt: "desc" },
    take: 5000,
  });
}

export async function resolveWorkspaceCategoryId(
  workspaceId: string,
  categoryName: string,
): Promise<{ id: string; name: string } | null> {
  const categories = await db.category.findMany({
    where: { workspaceId },
    select: { id: true, name: true },
  });
  return matchCategoryByName(categories, categoryName);
}

export async function runAssistantTool(
  userId: string,
  workspaceId: string,
  validated: ValidatedAssistantIntent,
): Promise<AssistantToolResult> {
  const todayCivil = civilDateFromInstant(new Date());
  const today: MonthRef = { year: todayCivil.year, month: todayCivil.month };

  switch (validated.intent) {
    case "expense_total_by_category":
      return expenseTotalByCategory(userId, workspaceId, validated.parameters, today);
    case "expense_trend_by_category":
      return expenseTrendByCategory(workspaceId, validated.parameters, today);
    case "savings_rate":
      return savingsRate(workspaceId, validated.parameters, today);
    case "upcoming_payments":
      return upcomingPayments(userId, workspaceId, validated.parameters);
    case "emergency_fund_gap":
      return emergencyFundGap(userId, workspaceId);
    case "highest_balance_account":
      return highestBalanceAccount(userId, workspaceId);
    case "can_save_monthly":
      return canSaveMonthly(workspaceId, validated.parameters, today);
    default: {
      const _exhaustive: never = validated;
      throw new Error(`UNKNOWN_TOOL:${String(_exhaustive)}`);
    }
  }
}

async function expenseTotalByCategory(
  _userId: string,
  workspaceId: string,
  params: { categoryName: string; period?: AssistantPeriod },
  today: MonthRef,
): Promise<AssistantToolResult> {
  const category = await resolveWorkspaceCategoryId(workspaceId, params.categoryName);
  if (!category) throw new Error("UNKNOWN_CATEGORY");

  const period = parseAssistantPeriodDefault(params.period, today);
  const months = periodToMonths(period, today);
  const transactions = await loadCompletedExpenses(workspaceId);
  const dataIncomplete = transactions.length >= 5000;

  const inScope = transactions.filter(
    (tx) =>
      (tx.categoryId ?? "none") === category.id &&
      months.some((m) => isInstantInCivilMonth(tx.occurredAt, m.year, m.month)),
  );

  const total = calculateExpenses(inScope.map(toMovement)).toFixed(2);
  const count = inScope.length;

  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  const from = formatCivilDateIso({ year: firstMonth.year, month: firstMonth.month, day: 1 });
  const toInstant = startOfNextCivilMonth(lastMonth.year, lastMonth.month);
  const toCivil = civilDateFromInstant(new Date(toInstant.getTime() - 86_400_000));
  const to = formatCivilDateIso(toCivil);

  const top = [...inScope]
    .sort((a, b) => decimal(b.amount.toString()).abs().cmp(decimal(a.amount.toString()).abs()))
    .slice(0, ASSISTANT_MAX_EVIDENCE_TX);

  const evidence = [
    `${count} despesa(s) na categoria «${category.name}» (${periodLabel(period, today)}).`,
    `Total: ${formatEUR(total)}.`,
    ...top.map(
      (tx) =>
        `${formatEUR(decimal(tx.amount.toString()).abs().toFixed(2))} — ${truncateDescription(tx.description ?? "Sem descrição")}`,
    ),
  ];

  return {
    summaryKey: "expense_total_by_category",
    facts: {
      categoryName: category.name,
      categoryId: category.id,
      total,
      count,
      periodLabel: periodLabel(period, today),
    },
    evidence,
    links: [
      transacoesLink({
        type: "EXPENSE",
        categoryId: category.id,
        from,
        to,
      }),
      { label: "Orçamentos", href: "/orcamentos" },
    ],
    dataIncomplete,
  };
}

async function expenseTrendByCategory(
  workspaceId: string,
  params: { months?: number },
  today: MonthRef,
): Promise<AssistantToolResult> {
  const windowMonths = params.months ?? 3;
  const recent = monthsBack(today, windowMonths);
  const prior = monthsBack(
    { year: recent[0].year, month: recent[0].month === 1 ? 12 : recent[0].month - 1 },
    windowMonths,
  );

  const transactions = await loadCompletedExpenses(workspaceId);
  const dataIncomplete = transactions.length >= 5000;

  const sumByCategory = (months: MonthRef[]) => {
    const map = new Map<string, { name: string; total: ReturnType<typeof decimal> }>();
    for (const tx of transactions) {
      if (!months.some((m) => isInstantInCivilMonth(tx.occurredAt, m.year, m.month))) continue;
      const id = tx.categoryId ?? "none";
      const name = tx.category?.name ?? "Sem categoria";
      const add = decimal(tx.amount.toString()).abs();
      const prev = map.get(id);
      map.set(id, { name, total: prev ? prev.total.plus(add) : add });
    }
    return map;
  };

  const recentMap = sumByCategory(recent);
  const priorMap = sumByCategory(prior);

  const increased: { name: string; delta: string; recent: string; prior: string; categoryId: string }[] = [];
  for (const [categoryId, row] of recentMap.entries()) {
    const prev = priorMap.get(categoryId)?.total ?? decimal(0);
    if (row.total.gt(prev)) {
      increased.push({
        categoryId,
        name: row.name,
        recent: row.total.toFixed(2),
        prior: prev.toFixed(2),
        delta: row.total.minus(prev).toFixed(2),
      });
    }
  }

  increased.sort((a, b) => decimal(b.delta).cmp(decimal(a.delta)));

  const evidence = increased.length
    ? increased.slice(0, ASSISTANT_MAX_EVIDENCE_TX).map(
        (row) =>
          `«${row.name}»: ${formatEUR(row.prior)} → ${formatEUR(row.recent)} (+${formatEUR(row.delta)})`,
      )
    : [`Nenhuma categoria aumentou nos últimos ${windowMonths} meses face ao período anterior.`];

  const top = increased[0];
  const links: AssistantLink[] = [{ label: "Análises", href: "/analises" }];
  if (top && top.categoryId !== "none") {
    links.unshift(
      transacoesLink({
        type: "EXPENSE",
        categoryId: top.categoryId,
        from: formatCivilDateIso({ year: prior[0].year, month: prior[0].month, day: 1 }),
        to: formatCivilDateIso(todayCivilFromMonth(today)),
      }),
    );
  }

  return {
    summaryKey: "expense_trend_by_category",
    facts: {
      windowMonths,
      increasedCount: increased.length,
    },
    evidence,
    links,
    dataIncomplete,
  };
}

function todayCivilFromMonth(ref: MonthRef) {
  const now = civilDateFromInstant(new Date());
  if (ref.year === now.year && ref.month === now.month) return now;
  return { year: ref.year, month: ref.month, day: 1 };
}

async function savingsRate(
  workspaceId: string,
  params: { period?: AssistantPeriod },
  today: MonthRef,
): Promise<AssistantToolResult> {
  const period = parseAssistantPeriodDefault(params.period, today);
  const months = periodToMonths(period, today);
  const transactions = await loadCompletedIncomeExpense(workspaceId);
  const dataIncomplete = transactions.length >= 5000;

  const inScope = transactions.filter((tx) =>
    months.some((m) => isInstantInCivilMonth(tx.occurredAt, m.year, m.month)),
  );
  const movements = inScope.map(toMovement);
  const income = calculateIncome(movements);
  const expenses = calculateExpenses(movements);
  const net = calculateCashFlow(movements);
  const rate =
    income.gt(0) ? net.div(income).times(100).toFixed(1) : income.eq(0) && expenses.eq(0) ? "0.0" : "N/D";

  const evidence = [
    `Receitas: ${formatEUR(income.toFixed(2))}; despesas: ${formatEUR(expenses.toFixed(2))}.`,
    `Taxa de poupança = (receitas − despesas) ÷ receitas × 100 = ${rate === "N/D" ? "N/D (sem receitas)" : `${rate}%`}.`,
    `${inScope.length} movimento(s) no período ${periodLabel(period, today)}.`,
  ];

  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  const from = formatCivilDateIso({ year: firstMonth.year, month: firstMonth.month, day: 1 });
  const to = formatCivilDateIso(todayCivilFromMonth(lastMonth));

  return {
    summaryKey: "savings_rate",
    facts: {
      income: income.toFixed(2),
      expenses: expenses.toFixed(2),
      net: net.toFixed(2),
      savingsRatePercent: rate,
      periodLabel: periodLabel(period, today),
    },
    evidence,
    links: [
      { label: "Dashboard", href: "/dashboard" },
      transacoesLink({ from, to }),
    ],
    dataIncomplete,
  };
}

async function upcomingPayments(
  _userId: string,
  workspaceId: string,
  params: { days?: number },
): Promise<AssistantToolResult> {
  const days = params.days ?? 7;
  const asOf = new Date();
  const start = treasuryHorizonStart(asOf);
  const horizonEnd = treasuryHorizonEnd(asOf, days);

  const events = await collectTreasuryForecastEvents(workspaceId, start, horizonEnd);
  const outflows = events
    .filter((e) => e.direction === "outflow")
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, ASSISTANT_MAX_EVIDENCE_TX);

  const total = outflows.reduce((sum, e) => sum.plus(e.amount), decimal(0)).toFixed(2);

  const evidence =
    outflows.length > 0
      ? [
          `${outflows.length} pagamento(s) previsto(s) nos próximos ${days} dias (total ${formatEUR(total)}).`,
          ...outflows.map(
            (e) =>
              `${formatCivilDateIso(civilDateFromInstant(e.dueDate))}: ${truncateDescription(e.label)} — ${formatEUR(e.amount)}`,
          ),
        ]
      : [`Sem pagamentos previstos nos próximos ${days} dias neste workspace.`];

  return {
    summaryKey: "upcoming_payments",
    facts: { days, count: outflows.length, totalOutflow: total },
    evidence,
    links: [
      { label: "Despesas recorrentes", href: "/despesas-recorrentes" },
      { label: "Previsões", href: "/previsoes" },
      { label: "Alertas", href: "/alertas" },
    ],
    dataIncomplete: events.length > 200,
  };
}

async function emergencyFundGap(userId: string, workspaceId: string): Promise<AssistantToolResult> {
  const planning = await getPlanningOverview(userId, workspaceId);
  if (!planning) throw new Error("NO_ACCESS");

  const target = decimal(planning.emergencyTarget);
  const current = decimal(planning.dashboardKpis.savingsBalance);
  const gap = target.minus(current);
  const evidence = [
    `Objetivo de fundo de emergência: ${formatEUR(target.toFixed(2))} (${planning.settings.emergencyFundTargetMonths} meses × despesas essenciais).`,
    `Poupança registada: ${formatEUR(current.toFixed(2))}.`,
    gap.gt(0)
      ? `Faltam ${formatEUR(gap.toFixed(2))} para atingir o objetivo.`
      : `Excedente de ${formatEUR(gap.abs().toFixed(2))} face ao objetivo.`,
  ];

  return {
    summaryKey: "emergency_fund_gap",
    facts: {
      target: target.toFixed(2),
      current: current.toFixed(2),
      gap: gap.toFixed(2),
      months: planning.settings.emergencyFundTargetMonths,
    },
    evidence,
    links: [
      { label: "Planeamento", href: "/planeamento" },
      { label: "Previsões", href: "/previsoes" },
    ],
  };
}

async function highestBalanceAccount(userId: string, workspaceId: string): Promise<AssistantToolResult> {
  const accounts = await listAccountsWithBalances(userId, workspaceId);
  if (!accounts?.length) throw new Error("NO_ACCOUNTS");

  const sorted = [...accounts].sort((a, b) => decimal(b.currentBalance).cmp(decimal(a.currentBalance)));
  const top = sorted[0];
  const evidence = sorted.slice(0, Math.min(ASSISTANT_MAX_EVIDENCE_TX, sorted.length)).map(
    (a) => `${a.name}: ${formatEUR(a.currentBalance)}`,
  );

  return {
    summaryKey: "highest_balance_account",
    facts: {
      accountName: top.name,
      accountId: top.id,
      balance: top.currentBalance,
    },
    evidence: [`Conta com maior saldo: «${top.name}» (${formatEUR(top.currentBalance)}).`, ...evidence.slice(1)],
    links: [
      { label: "Contas", href: "/contas" },
      transacoesLink({ accountId: top.id }),
    ],
  };
}

async function canSaveMonthly(
  workspaceId: string,
  params: { amount: number | string },
  today: MonthRef,
): Promise<AssistantToolResult> {
  const targetSave = decimal(normalizeDecimalInput(String(params.amount))).abs();
  const months = monthsBack(today, 6);
  const transactions = await loadCompletedIncomeExpense(workspaceId);
  const dataIncomplete = transactions.length >= 5000;

  const nets = months.map((m) => {
    const slice = transactions.filter((tx) => isInstantInCivilMonth(tx.occurredAt, m.year, m.month));
    return calculateCashFlow(slice.map(toMovement));
  });
  const withData = nets.filter((n) => !n.eq(0));
  const average =
    withData.length > 0
      ? withData.reduce((s, n) => s.plus(n), decimal(0)).div(withData.length)
      : decimal(0);

  const feasible = average.gte(targetSave);
  const evidence = [
    `Poupança pedida: ${formatEUR(targetSave.toFixed(2))}/mês.`,
    `Fluxo líquido médio (${withData.length} mês(es) com movimentos): ${formatEUR(average.toFixed(2))}.`,
    feasible
      ? "Com base na média recente, o montante parece compatível."
      : `Faltam cerca de ${formatEUR(targetSave.minus(average).toFixed(2))} face à média recente.`,
  ];

  return {
    summaryKey: "can_save_monthly",
    facts: {
      requested: targetSave.toFixed(2),
      averageNet: average.toFixed(2),
      feasible,
    },
    evidence,
    links: [
      { label: "Simulações", href: "/simulacoes" },
      { label: "Previsões", href: "/previsoes" },
    ],
    dataIncomplete,
  };
}
