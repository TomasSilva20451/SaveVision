import { decimal, roundMoney } from "@/lib/finance/money";

export type EcommerceInput = {
  grossAmount: string;
  marketplaceFees?: string;
  paymentFees?: string;
  shippingCost?: string;
  costOfGoods?: string;
  otherCosts?: string;
  taxReservePercentage?: string;
};

export function calculateEcommerceNetProceeds(input: EcommerceInput) {
  const gross = decimal(input.grossAmount);
  const net = gross
    .minus(input.marketplaceFees ?? 0)
    .minus(input.paymentFees ?? 0)
    .minus(input.shippingCost ?? 0)
    .minus(input.costOfGoods ?? 0)
    .minus(input.otherCosts ?? 0);

  const pct = decimal(input.taxReservePercentage ?? 0);
  const taxReserveAmount = roundMoney(net.times(pct).div(100));

  return {
    netProceeds: roundMoney(net),
    taxReserveAmount,
  };
}
