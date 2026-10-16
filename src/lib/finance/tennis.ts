import { decimal, roundMoney } from "@/lib/finance/money";

export type TennisInput = {
  grossPrize: string;
  registrationFee?: string;
  travelCost?: string;
  accommodationCost?: string;
  foodCost?: string;
  otherCosts?: string;
};

export function calculateTennisNetPrize(input: TennisInput) {
  const net = decimal(input.grossPrize)
    .minus(input.registrationFee ?? 0)
    .minus(input.travelCost ?? 0)
    .minus(input.accommodationCost ?? 0)
    .minus(input.foodCost ?? 0)
    .minus(input.otherCosts ?? 0);

  return roundMoney(net);
}
