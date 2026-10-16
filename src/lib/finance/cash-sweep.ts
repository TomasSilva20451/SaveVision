import { decimal } from "@/lib/finance/money";

export type CashSweepInput = {
  currentAccountBalance: string;
  minimumBuffer: string;
  savingsGoalGap: string;
};

export type CashSweepSuggestion = {
  suggestedAmount: string;
  rationale: string;
};

export function suggestCashSweep(
  input: CashSweepInput,
): CashSweepSuggestion | null {
  const balance = decimal(input.currentAccountBalance);
  const buffer = decimal(input.minimumBuffer);
  const gap = decimal(input.savingsGoalGap);

  const excess = balance.minus(buffer);
  if (excess.lte(0) || gap.lte(0)) {
    return null;
  }

  const amount = excess.lt(gap) ? excess : gap;
  return {
    suggestedAmount: amount.toFixed(2),
    rationale:
      "Sugestão apenas informativa: excedente acima do colchão mínimo que pode ir para poupança. Não executa transferências.",
  };
}
