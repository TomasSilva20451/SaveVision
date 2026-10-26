import { decimal } from "@/lib/finance/money";

const P90_Z = decimal("1.281551565545");

export type ProbabilisticForecast = {
  horizonMonths: number;
  sampleMonths: number;
  monthlyMean: string;
  monthlyVolatility: string;
  p10: string;
  p50: string;
  p90: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  method: "EMPIRICAL_NORMAL_BAND_V1";
};

/**
 * Banda probabilística explicável sobre fluxos mensais observados. Não é uma
 * promessa nem um modelo de mercado: P10/P50/P90 são cenários estatísticos.
 */
export function forecastCashBalanceDistribution(input: {
  currentBalance: string;
  monthlyNetFlows: readonly string[];
  horizonMonths: number;
}): ProbabilisticForecast {
  const horizon = Math.max(1, Math.min(36, Math.trunc(input.horizonMonths)));
  const values = input.monthlyNetFlows.map((value) => decimal(value));
  const sampleMonths = values.length;
  const mean = sampleMonths
    ? values.reduce((sum, value) => sum.plus(value), decimal(0)).div(sampleMonths)
    : decimal(0);
  const variance = sampleMonths > 1
    ? values
        .reduce((sum, value) => sum.plus(value.minus(mean).pow(2)), decimal(0))
        .div(sampleMonths - 1)
    : decimal(0);
  const volatility = variance.sqrt();
  const p50 = decimal(input.currentBalance).plus(mean.times(horizon));
  const band = volatility.times(decimal(horizon).sqrt()).times(P90_Z);

  return {
    horizonMonths: horizon,
    sampleMonths,
    monthlyMean: mean.toFixed(2),
    monthlyVolatility: volatility.toFixed(2),
    p10: p50.minus(band).toFixed(2),
    p50: p50.toFixed(2),
    p90: p50.plus(band).toFixed(2),
    confidence: sampleMonths >= 12 ? "HIGH" : sampleMonths >= 6 ? "MEDIUM" : "LOW",
    method: "EMPIRICAL_NORMAL_BAND_V1",
  };
}

export type LiquidityRisk = {
  level: "LOW" | "MEDIUM" | "HIGH";
  reasons: string[];
  p10Buffer: string;
};

export function assessLiquidityRisk(input: {
  forecast: ProbabilisticForecast;
  next30DaysKnownOutflows: string;
  currentBalance: string;
}): LiquidityRisk {
  const p10 = decimal(input.forecast.p10);
  const balance = decimal(input.currentBalance);
  const knownOutflows = decimal(input.next30DaysKnownOutflows).abs();
  const reasons: string[] = [];

  if (p10.lt(0)) reasons.push("O cenário P10 termina com saldo negativo.");
  if (knownOutflows.gt(balance)) reasons.push("As saídas conhecidas a 30 dias excedem o saldo atual.");
  if (input.forecast.confidence === "LOW") reasons.push("Há menos de seis meses completos de histórico.");

  const level = p10.lt(0) || knownOutflows.gt(balance)
    ? "HIGH"
    : p10.lt(knownOutflows) || input.forecast.confidence === "LOW"
      ? "MEDIUM"
      : "LOW";
  if (reasons.length === 0) reasons.push("O cenário conservador mantém uma almofada positiva.");

  return { level, reasons, p10Buffer: p10.toFixed(2) };
}

export function explainableSavingsRecommendation(input: {
  forecast: ProbabilisticForecast;
  liquidityRisk: LiquidityRisk;
  emergencyFundGap: string;
}): { suggestedMonthlyAmount: string; reasons: string[]; requiresConfirmation: true } {
  const mean = decimal(input.forecast.monthlyMean);
  const positiveMean = mean.lt(0) ? decimal(0) : mean;
  const riskFactor = input.liquidityRisk.level === "HIGH" ? decimal(0) : input.liquidityRisk.level === "MEDIUM" ? decimal("0.25") : decimal("0.5");
  const suggestion = positiveMean.times(riskFactor).toDecimalPlaces(2);
  const reasons = [
    `Base: fluxo líquido médio observado de ${positiveMean.toFixed(2)} € por mês.`,
    `Ajuste conservador para risco de liquidez ${input.liquidityRisk.level}.`,
  ];
  if (decimal(input.emergencyFundGap).gt(0)) {
    reasons.push("Priorizar o fundo de emergência antes de outros objetivos.");
  }
  return { suggestedMonthlyAmount: suggestion.toFixed(2), reasons, requiresConfirmation: true };
}
