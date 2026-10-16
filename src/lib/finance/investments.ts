import { decimal } from "@/lib/finance/money";

export function positionMarketValue(quantity: string, manualPrice: string): string {
  return decimal(quantity).times(manualPrice).toFixed(2);
}

export function positionUnrealizedPnl(
  quantity: string,
  manualPrice: string,
  costBasis: string,
): string {
  const market = decimal(quantity).times(manualPrice);
  return market.minus(costBasis).toFixed(2);
}

export function positionReturnPercent(
  quantity: string,
  manualPrice: string,
  costBasis: string,
): number | null {
  const basis = decimal(costBasis);
  if (basis.lte(0)) return null;
  const pnl = decimal(positionUnrealizedPnl(quantity, manualPrice, costBasis));
  return pnl.div(basis).times(100).toDecimalPlaces(1).toNumber();
}
