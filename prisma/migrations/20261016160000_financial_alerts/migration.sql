-- CreateEnum
CREATE TYPE "FinancialAlertSeverity" AS ENUM ('INFO', 'ATTENTION', 'HIGH', 'CRITICAL');
CREATE TYPE "FinancialAlertStatus" AS ENUM ('ACTIVE', 'RESOLVED');
CREATE TYPE "FinancialAlertType" AS ENUM (
  'LOW_PROJECTED_BALANCE',
  'NEGATIVE_PROJECTED_BALANCE',
  'BUDGET_NEAR_LIMIT',
  'BUDGET_EXCEEDED',
  'RECURRING_EXPENSE_DUE',
  'RECURRING_EXPENSE_OVERDUE',
  'EXPECTED_INCOME_OVERDUE',
  'UNUSUAL_EXPENSE',
  'EMERGENCY_FUND_BELOW_TARGET',
  'RECURRING_LIABILITY_CONFIGURATION',
  'DUPLICATE_PAYMENT_RISK'
);

CREATE TABLE "FinancialAlert" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "type" "FinancialAlertType" NOT NULL,
  "severity" "FinancialAlertSeverity" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "FinancialAlertStatus" NOT NULL DEFAULT 'ACTIVE',
  "deduplicationKey" TEXT NOT NULL,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "evidence" JSONB,
  "actionUrl" TEXT,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastEvaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FinancialAlert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialAlertUserState" (
  "id" TEXT NOT NULL,
  "alertId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "seenAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FinancialAlertUserState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinancialAlert_workspaceId_deduplicationKey_key" ON "FinancialAlert"("workspaceId", "deduplicationKey");
CREATE INDEX "FinancialAlert_workspaceId_status_severity_idx" ON "FinancialAlert"("workspaceId", "status", "severity");

CREATE UNIQUE INDEX "FinancialAlertUserState_alertId_userId_key" ON "FinancialAlertUserState"("alertId", "userId");
CREATE INDEX "FinancialAlertUserState_userId_dismissedAt_idx" ON "FinancialAlertUserState"("userId", "dismissedAt");

ALTER TABLE "FinancialAlert" ADD CONSTRAINT "FinancialAlert_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialAlertUserState" ADD CONSTRAINT "FinancialAlertUserState_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "FinancialAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialAlertUserState" ADD CONSTRAINT "FinancialAlertUserState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
