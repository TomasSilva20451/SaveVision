import { calculateNetWorth } from "@/lib/finance/aggregates";
import { decimal } from "@/lib/finance/money";
import type { AccountSnapshot, LedgerMovement } from "@/lib/finance/types";
import { positionMarketValue } from "@/lib/finance/investments";

export type PatrimonyInput = {
  accounts: readonly AccountSnapshot[];
  movements: readonly LedgerMovement[];
  investmentPositions: readonly {
    quantity: string;
    manualPrice: string;
    valuationMode?: "STANDALONE" | "ACCOUNT_COMPONENT";
    linkedAccountId?: string | null;
  }[];
  manualLiabilities: readonly { outstandingBalance: string }[];
};

export function calculatePatrimonyNet(input: PatrimonyInput): {
  accountNetWorth: string;
  investmentsValue: string;
  manualLiabilities: string;
  netPatrimony: string;
} {
  const accountNetWorth = calculateNetWorth(input.accounts, input.movements);
  const investmentsValue = input.investmentPositions
    .filter(
      (p) =>
        p.valuationMode !== "ACCOUNT_COMPONENT" && !p.linkedAccountId,
    )
    .reduce(
      (sum, p) => sum.plus(positionMarketValue(p.quantity, p.manualPrice)),
      decimal(0),
    );

  const liabilitiesTotal = input.manualLiabilities.reduce(
    (sum, l) => sum.plus(l.outstandingBalance),
    decimal(0),
  );

  const netPatrimony = accountNetWorth
    .plus(investmentsValue)
    .minus(liabilitiesTotal);

  return {
    accountNetWorth: accountNetWorth.toFixed(2),
    investmentsValue: investmentsValue.toFixed(2),
    manualLiabilities: liabilitiesTotal.toFixed(2),
    netPatrimony: netPatrimony.toFixed(2),
  };
}

export function amortizationPatrimonyImpact(
  principal: string,
  interest: string,
  fees: string,
): {
  cashImpact: string;
  liabilityImpact: string;
  netWorthImpactFromPrincipal: string;
  expenseFromInterestAndFees: string;
} {
  const principalDec = decimal(principal);
  const interestDec = decimal(interest).plus(fees);
  return {
    cashImpact: principalDec.plus(interestDec).negated().toFixed(2),
    liabilityImpact: principalDec.negated().toFixed(2),
    netWorthImpactFromPrincipal: "0.00",
    expenseFromInterestAndFees: interestDec.toFixed(2),
  };
}
