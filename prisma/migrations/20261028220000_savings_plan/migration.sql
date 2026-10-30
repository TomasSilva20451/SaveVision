-- CreateEnum
CREATE TYPE "SavingsPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "SavingsPlanCadence" AS ENUM ('WEEKLY');
CREATE TYPE "SavingsPlanCheckInStatus" AS ENUM ('DUE', 'COMPLETED', 'MISSED', 'SKIPPED');

-- AlterEnum
ALTER TYPE "FinancialAlertType" ADD VALUE IF NOT EXISTS 'SAVINGS_PLAN_CONTRIBUTION_DUE';
ALTER TYPE "FinancialAlertType" ADD VALUE IF NOT EXISTS 'SAVINGS_PLAN_CONTRIBUTION_MISSED';
ALTER TYPE "FinancialAlertType" ADD VALUE IF NOT EXISTS 'SAVINGS_PLAN_ACCOUNT_WITHDRAWAL';
ALTER TYPE "FinancialAlertType" ADD VALUE IF NOT EXISTS 'SAVINGS_PLAN_COMPLETED';

-- CreateTable
CREATE TABLE "SavingsPlan" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "savingsAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SavingsPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "plannedContributionAmount" DECIMAL(19,4) NOT NULL,
    "cadence" "SavingsPlanCadence" NOT NULL DEFAULT 'WEEKLY',
    "contributionWeekday" INTEGER NOT NULL,
    "reviewWeekday" INTEGER NOT NULL,
    "alertThresholdPercent" INTEGER NOT NULL DEFAULT 75,
    "activatedAt" TIMESTAMP(3),
    "nextContributionDueAt" TIMESTAMP(3),
    "investmentGuardEnabled" BOOLEAN NOT NULL DEFAULT true,
    "activationKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SavingsPlanBudgetRule" (
    "id" TEXT NOT NULL,
    "savingsPlanId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "monthlyLimitAmount" DECIMAL(19,4) NOT NULL,
    "alertThresholdPercent" INTEGER NOT NULL,

    CONSTRAINT "SavingsPlanBudgetRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SavingsPlanCheckIn" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "savingsPlanId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "expectedAmount" DECIMAL(19,4) NOT NULL,
    "status" "SavingsPlanCheckInStatus" NOT NULL DEFAULT 'DUE',
    "contributionId" TEXT,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsPlanCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavingsPlan_goalId_key" ON "SavingsPlan"("goalId");
CREATE UNIQUE INDEX "SavingsPlan_workspaceId_activationKey_key" ON "SavingsPlan"("workspaceId", "activationKey");
CREATE INDEX "SavingsPlan_workspaceId_status_idx" ON "SavingsPlan"("workspaceId", "status");

CREATE UNIQUE INDEX "SavingsPlanBudgetRule_savingsPlanId_categoryId_key" ON "SavingsPlanBudgetRule"("savingsPlanId", "categoryId");

CREATE UNIQUE INDEX "SavingsPlanCheckIn_savingsPlanId_periodStart_key" ON "SavingsPlanCheckIn"("savingsPlanId", "periodStart");
CREATE INDEX "SavingsPlanCheckIn_workspaceId_savingsPlanId_status_idx" ON "SavingsPlanCheckIn"("workspaceId", "savingsPlanId", "status");

-- AddForeignKey
ALTER TABLE "SavingsPlan" ADD CONSTRAINT "SavingsPlan_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavingsPlan" ADD CONSTRAINT "SavingsPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavingsPlan" ADD CONSTRAINT "SavingsPlan_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "SavingsGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavingsPlan" ADD CONSTRAINT "SavingsPlan_savingsAccountId_fkey" FOREIGN KEY ("savingsAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SavingsPlanBudgetRule" ADD CONSTRAINT "SavingsPlanBudgetRule_savingsPlanId_fkey" FOREIGN KEY ("savingsPlanId") REFERENCES "SavingsPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavingsPlanBudgetRule" ADD CONSTRAINT "SavingsPlanBudgetRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SavingsPlanCheckIn" ADD CONSTRAINT "SavingsPlanCheckIn_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavingsPlanCheckIn" ADD CONSTRAINT "SavingsPlanCheckIn_savingsPlanId_fkey" FOREIGN KEY ("savingsPlanId") REFERENCES "SavingsPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavingsPlanCheckIn" ADD CONSTRAINT "SavingsPlanCheckIn_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "SavingsGoalContribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
