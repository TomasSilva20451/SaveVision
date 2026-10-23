import { decimal } from "@/lib/finance/money";

/**
 * Equivalente mensal contratual de uma recorrência ativa.
 * Semanal = valor × 52/12; quinzenal = × 26/12; mensal = valor;
 * trimestral = ÷ 3; semestral = ÷ 6; anual = ÷ 12.
 * Não é o total previsto nem o total pago num mês civil.
 */
export function monthlyEquivalentAmount(amount: string, frequency: string): string {
  const value = decimal(amount);
  switch (frequency) {
    case "WEEKLY":
      return value.times(52).div(12).toDecimalPlaces(2).toFixed(2);
    case "BIWEEKLY":
      return value.times(26).div(12).toDecimalPlaces(2).toFixed(2);
    case "QUARTERLY":
      return value.div(3).toDecimalPlaces(2).toFixed(2);
    case "SEMIANNUAL":
      return value.div(6).toDecimalPlaces(2).toFixed(2);
    case "YEARLY":
      return value.div(12).toDecimalPlaces(2).toFixed(2);
    default:
      return value.toDecimalPlaces(2).toFixed(2);
  }
}
