import Decimal from "decimal.js";

Decimal.set({
  precision: 34,
  rounding: Decimal.ROUND_HALF_UP,
});

/** Casas usadas na apresentação em euros. */
export const MONEY_DISPLAY_SCALE = 2;

/** Casas guardadas na base de dados. */
export const MONEY_STORAGE_SCALE = 4;

/**
 * Normaliza montantes introduzidos pelo utilizador para o formato decimal
 * canónico usado pelo domínio e pela base de dados. Aceita tanto a vírgula
 * portuguesa como o ponto decimal, incluindo agrupamento comum de milhares.
 */
export function normalizeDecimalInput(value: string): string {
  const compact = value.trim().replace(/[\s\u00a0\u202f]/g, "");
  if (!compact) throw new Error("Montante vazio.");

  const commaCount = (compact.match(/,/g) ?? []).length;
  const dotCount = (compact.match(/\./g) ?? []).length;
  let normalized = compact;

  if (commaCount > 0 && dotCount > 0) {
    const commaIsDecimal = compact.lastIndexOf(",") > compact.lastIndexOf(".");
    const decimalSeparator = commaIsDecimal ? "," : ".";
    const groupingSeparator = commaIsDecimal ? "." : ",";
    const decimalCount = decimalSeparator === "," ? commaCount : dotCount;
    if (decimalCount !== 1) throw new Error("Montante inválido.");
    normalized = compact.replaceAll(groupingSeparator, "");
    if (decimalSeparator === ",") normalized = normalized.replace(",", ".");
  } else if (commaCount > 0) {
    if (commaCount !== 1) throw new Error("Montante inválido.");
    normalized = compact.replace(",", ".");
  } else if (dotCount > 1) {
    throw new Error("Montante inválido.");
  }

  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
    throw new Error("Montante inválido.");
  }

  return normalized;
}

const eurFormatter = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  useGrouping: "always",
  minimumFractionDigits: MONEY_DISPLAY_SCALE,
  maximumFractionDigits: MONEY_DISPLAY_SCALE,
});

export function decimal(value: Decimal.Value): Decimal {
  return new Decimal(
    typeof value === "string" ? normalizeDecimalInput(value) : value,
  );
}

export function roundMoney(
  value: Decimal.Value,
  scale: number = MONEY_DISPLAY_SCALE,
): Decimal {
  return decimal(value).toDecimalPlaces(scale, Decimal.ROUND_HALF_UP);
}

export function addMoney(values: readonly Decimal.Value[]): Decimal {
  return values.reduce<Decimal>(
    (sum, value) => sum.plus(decimal(value)),
    decimal(0),
  );
}

/**
 * Formata um montante já quantizado a cêntimos.
 * A conversão para number acontece só depois do arredondamento decimal.
 */
export function formatEUR(value: Decimal.Value): string {
  const rounded = roundMoney(value);
  const cents = rounded.times(100);

  if (!cents.isInteger() || cents.abs().greaterThan(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Montante fora do intervalo seguro para formatação.");
  }

  return eurFormatter.format(rounded.toNumber());
}
