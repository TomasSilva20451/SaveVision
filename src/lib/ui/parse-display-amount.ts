import { decimal, roundMoney } from "@/lib/finance/money";

/** Converte string de montante (domínio ou já formatada em EUR) para número de apresentação. */
export function parseDisplayAmount(value: string, rawValue: boolean): number {
  if (rawValue || value.includes("€")) {
    const stripped = value.replace(/[^\d,.+-]/g, "").trim();
    if (!stripped) return 0;
    const lastComma = stripped.lastIndexOf(",");
    const lastDot = stripped.lastIndexOf(".");
    let normalized = stripped;
    if (lastComma > -1 && lastDot > -1) {
      const commaIsDecimal = lastComma > lastDot;
      const grouping = commaIsDecimal ? "." : ",";
      const decimalSep = commaIsDecimal ? "," : ".";
      normalized = stripped.replaceAll(grouping, "");
      if (decimalSep === ",") normalized = normalized.replace(",", ".");
    } else if (lastComma > -1) {
      normalized = stripped.replace(",", ".");
    }
    try {
      return roundMoney(decimal(normalized)).toNumber();
    } catch {
      return 0;
    }
  }
  try {
    return roundMoney(decimal(value)).toNumber();
  } catch {
    return 0;
  }
}
