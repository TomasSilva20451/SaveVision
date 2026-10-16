import type { SimulationLiabilityRow } from "@/server/services/financial-simulations";

export type SimulationBaseline = {
  workspaceId: string;
  asOfCivil: string;
  asOfInstant: string;
  aggregateBalance: string;
  monthlyIncomeObserved: string;
  monthlyExpenseObserved: string;
  savingsBalance: string;
  emergencyTarget: string | null;
  monthlyEssential: string;
  emergencyTargetMonths: number;
  liabilities: SimulationLiabilityRow[];
  treasury: {
    startingBalance: string;
    horizonStart: string;
    knownEventCount: number;
    minProjectedBalance30: string | null;
    minProjectedDate30: string | null;
    horizonsSupported: number[];
  } | null;
  disclaimer: string;
};
