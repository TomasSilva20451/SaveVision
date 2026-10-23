import type { ValidatedAssistantIntent } from "@/lib/finance/financial-assistant-intents";
import { decimal, formatEUR } from "@/lib/finance/money";

export type AssistantFormatInput = {
  summaryKey: string;
  facts: Record<string, string | number | boolean>;
};

export function formatAssistantAnswer(
  _validated: ValidatedAssistantIntent,
  tool: AssistantFormatInput,
): string {
  switch (tool.summaryKey) {
    case "expense_total_by_category":
      return `Gastaste ${formatEUR(String(tool.facts.total))} em «${tool.facts.categoryName}» (${tool.facts.periodLabel}).`;
    case "expense_trend_by_category":
      return tool.facts.increasedCount
        ? `Identifiquei ${tool.facts.increasedCount} categoria(s) com subida nos últimos ${tool.facts.windowMonths} meses face ao período anterior.`
        : `Não há categorias com subida clara nos últimos ${tool.facts.windowMonths} meses.`;
    case "savings_rate":
      return `A taxa de poupança no período ${tool.facts.periodLabel} é ${tool.facts.savingsRatePercent}${tool.facts.savingsRatePercent === "N/D" ? "" : "%"} (receitas ${formatEUR(String(tool.facts.income))}, despesas ${formatEUR(String(tool.facts.expenses))}).`;
    case "upcoming_payments":
      return tool.facts.count
        ? `Tens ${tool.facts.count} pagamento(s) previsto(s) nos próximos ${tool.facts.days} dias, totalizando ${formatEUR(String(tool.facts.totalOutflow))}.`
        : `Não encontrei pagamentos previstos nos próximos ${tool.facts.days} dias.`;
    case "emergency_fund_gap": {
      const gap = decimal(String(tool.facts.gap));
      return gap.gt(0)
        ? `O fundo de emergência está ${formatEUR(gap.toFixed(2))} abaixo do objetivo (${formatEUR(String(tool.facts.target))}).`
        : `O fundo de emergência cumpre o objetivo de ${formatEUR(String(tool.facts.target))}.`;
    }
    case "highest_balance_account":
      return `A conta «${tool.facts.accountName}» tem o saldo mais alto: ${formatEUR(String(tool.facts.balance))}.`;
    case "can_save_monthly":
      return tool.facts.feasible
        ? `Poupar ${formatEUR(String(tool.facts.requested))} por mês é compatível com o fluxo líquido médio recente (${formatEUR(String(tool.facts.averageNet))}).`
        : `Poupar ${formatEUR(String(tool.facts.requested))} por mês excede o fluxo líquido médio recente (${formatEUR(String(tool.facts.averageNet))}).`;
    default:
      return "Resultado calculado a partir dos teus dados.";
  }
}
