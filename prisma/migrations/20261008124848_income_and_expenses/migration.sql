-- CreateEnum
CREATE TYPE "IncomeSourceType" AS ENUM ('FAMILY_TRANSFER', 'GIFT', 'ECOMMERCE', 'TENNIS_PRIZE', 'SALARY', 'FREELANCE', 'REFUND', 'INTEREST', 'OTHER');

-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM', 'ONE_OFF');

-- CreateEnum
CREATE TYPE "IncomeOccurrenceStatus" AS ENUM ('EXPECTED', 'RECEIVED', 'MISSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IncomeCertainty" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateTable
CREATE TABLE "IncomeSeries" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceType" "IncomeSourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "frequency" "RecurringFrequency" NOT NULL,
    "accountId" TEXT NOT NULL,
    "familyOrigin" TEXT,
    "certainty" "IncomeCertainty",
    "nextDueAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomeSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomeOccurrence" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seriesId" TEXT,
    "sourceType" "IncomeSourceType" NOT NULL,
    "status" "IncomeOccurrenceStatus" NOT NULL DEFAULT 'EXPECTED',
    "expectedAmount" DECIMAL(19,4) NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomeOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcommerceSale" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "marketplace" TEXT,
    "orderReference" TEXT,
    "grossAmount" DECIMAL(19,4) NOT NULL,
    "marketplaceFees" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "paymentFees" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "shippingCost" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "costOfGoods" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "otherCosts" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "netProceeds" DECIMAL(19,4) NOT NULL,
    "taxReservePercentage" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "taxReserveAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "payoutDate" TIMESTAMP(3),
    "notes" TEXT,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcommerceSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentIncome" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tournamentName" TEXT NOT NULL,
    "tournamentDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "category" TEXT,
    "placement" TEXT,
    "grossPrize" DECIMAL(19,4) NOT NULL,
    "registrationFee" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "travelCost" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "accommodationCost" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "foodCost" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "otherCosts" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "netPrize" DECIMAL(19,4) NOT NULL,
    "notes" TEXT,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentIncome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncomeSeries_workspaceId_active_idx" ON "IncomeSeries"("workspaceId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "IncomeOccurrence_transactionId_key" ON "IncomeOccurrence"("transactionId");

-- CreateIndex
CREATE INDEX "IncomeOccurrence_workspaceId_scheduledFor_status_idx" ON "IncomeOccurrence"("workspaceId", "scheduledFor", "status");

-- CreateIndex
CREATE INDEX "IncomeOccurrence_seriesId_idx" ON "IncomeOccurrence"("seriesId");

-- CreateIndex
CREATE UNIQUE INDEX "EcommerceSale_transactionId_key" ON "EcommerceSale"("transactionId");

-- CreateIndex
CREATE INDEX "EcommerceSale_workspaceId_saleDate_idx" ON "EcommerceSale"("workspaceId", "saleDate");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentIncome_transactionId_key" ON "TournamentIncome"("transactionId");

-- CreateIndex
CREATE INDEX "TournamentIncome_workspaceId_tournamentDate_idx" ON "TournamentIncome"("workspaceId", "tournamentDate");

-- AddForeignKey
ALTER TABLE "IncomeSeries" ADD CONSTRAINT "IncomeSeries_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeSeries" ADD CONSTRAINT "IncomeSeries_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeOccurrence" ADD CONSTRAINT "IncomeOccurrence_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeOccurrence" ADD CONSTRAINT "IncomeOccurrence_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "IncomeSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeOccurrence" ADD CONSTRAINT "IncomeOccurrence_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeOccurrence" ADD CONSTRAINT "IncomeOccurrence_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceSale" ADD CONSTRAINT "EcommerceSale_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceSale" ADD CONSTRAINT "EcommerceSale_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceSale" ADD CONSTRAINT "EcommerceSale_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentIncome" ADD CONSTRAINT "TournamentIncome_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentIncome" ADD CONSTRAINT "TournamentIncome_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentIncome" ADD CONSTRAINT "TournamentIncome_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
