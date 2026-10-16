-- CreateEnum
CREATE TYPE "LiabilityType" AS ENUM ('PERSONAL_LOAN', 'AUTO_LOAN', 'MORTGAGE', 'FAMILY_LOAN', 'OTHER');

-- CreateTable
CREATE TABLE "MonthlyBudget" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "monthlyBudgetId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "limitAmount" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialLiability" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "LiabilityType" NOT NULL DEFAULT 'OTHER',
    "outstandingBalance" DECIMAL(19,4) NOT NULL,
    "monthlyPayment" DECIMAL(19,4),
    "manualRatePercent" DECIMAL(7,4),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialLiability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiabilityPayment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "liabilityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "principalAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "interestAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "feesAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiabilityPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonthlyBudget_workspaceId_year_month_idx" ON "MonthlyBudget"("workspaceId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyBudget_workspaceId_year_month_key" ON "MonthlyBudget"("workspaceId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLine_monthlyBudgetId_categoryId_key" ON "BudgetLine"("monthlyBudgetId", "categoryId");

-- CreateIndex
CREATE INDEX "FinancialLiability_workspaceId_idx" ON "FinancialLiability"("workspaceId");

-- CreateIndex
CREATE INDEX "LiabilityPayment_liabilityId_paidAt_idx" ON "LiabilityPayment"("liabilityId", "paidAt");

-- AddForeignKey
ALTER TABLE "MonthlyBudget" ADD CONSTRAINT "MonthlyBudget_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_monthlyBudgetId_fkey" FOREIGN KEY ("monthlyBudgetId") REFERENCES "MonthlyBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLiability" ADD CONSTRAINT "FinancialLiability_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiabilityPayment" ADD CONSTRAINT "LiabilityPayment_liabilityId_fkey" FOREIGN KEY ("liabilityId") REFERENCES "FinancialLiability"("id") ON DELETE CASCADE ON UPDATE CASCADE;
