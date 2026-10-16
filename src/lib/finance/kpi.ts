import { decimal } from "@/lib/finance/money";

export function safePercentChange(current: string, previous: string): number | null {
  const prev = decimal(previous);
  const curr = decimal(current);

  if (prev.isZero()) {
    return null;
  }

  return curr.minus(prev).div(prev.abs()).times(100).toDecimalPlaces(1).toNumber();
}
