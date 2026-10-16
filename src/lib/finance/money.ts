import Decimal from "decimal.js";

Decimal.set({
  precision: 34,
  rounding: Decimal.ROUND_HALF_UP,
});

/** Casas usadas na apresentação em euros. */
export const MONEY_DISPLAY_SCALE = 2;

/** Casas guardadas na base de dados. */
export const MONEY_STORAGE_SCALE = 4;

const eurFormatter = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  useGrouping: "always",
  minimumFractionDigits: MONEY_DISPLAY_SCALE,
  maximumFractionDigits: MONEY_DISPLAY_SCALE,
});

export function decimal(value: Decimal.Value): Decimal {
  return new Decimal(value);
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
