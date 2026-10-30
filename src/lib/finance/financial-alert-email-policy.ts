import type { FinancialAlertSeverity, FinancialAlertType } from "@/generated/prisma/client";

export function isFinancialAlertEmailEligible(input: {
  type: FinancialAlertType;
  severity: FinancialAlertSeverity;
}): boolean {
  if (String(input.type).startsWith("SAVINGS_PLAN_")) return true;
  return input.severity === "CRITICAL" || input.severity === "HIGH";
}
