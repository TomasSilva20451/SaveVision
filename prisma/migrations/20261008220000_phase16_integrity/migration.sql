-- Phase 16: idempotent repair (partial apply safe)

DO $$ BEGIN
  CREATE TYPE "InvestmentValuationMode" AS ENUM ('STANDALONE', 'ACCOUNT_COMPONENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FinancialAuditAction" AS ENUM ('ACCOUNT_CREATED', 'TRANSACTION_CREATED', 'INCOME_CONFIRMED', 'BUDGET_CHANGED', 'LIABILITY_CREATED', 'LIABILITY_PAYMENT_RECORDED', 'NET_WORTH_SNAPSHOT_CREATED', 'INVESTMENT_CHANGED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "InvestmentPosition" ADD COLUMN IF NOT EXISTS "valuationMode" "InvestmentValuationMode" NOT NULL DEFAULT 'STANDALONE';
ALTER TABLE "InvestmentPosition" ADD COLUMN IF NOT EXISTS "linkedAccountId" TEXT;

ALTER TABLE "LiabilityPayment" ADD COLUMN IF NOT EXISTS "accountId" TEXT;
ALTER TABLE "LiabilityPayment" ADD COLUMN IF NOT EXISTS "principalTransactionId" TEXT;
ALTER TABLE "LiabilityPayment" ADD COLUMN IF NOT EXISTS "expenseTransactionId" TEXT;
ALTER TABLE "LiabilityPayment" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE TABLE IF NOT EXISTS "NetWorthSnapshot" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "cashTotal" DECIMAL(19,4) NOT NULL,
    "savingsTotal" DECIMAL(19,4) NOT NULL,
    "investmentsTotal" DECIMAL(19,4) NOT NULL,
    "manualAssetsTotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "liabilitiesTotal" DECIMAL(19,4) NOT NULL,
    "netWorth" DECIMAL(19,4) NOT NULL,
    "calculationVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NetWorthSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FinancialAuditLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" "FinancialAuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancialAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InvestmentPosition_linkedAccountId_idx" ON "InvestmentPosition"("linkedAccountId");
CREATE UNIQUE INDEX IF NOT EXISTS "LiabilityPayment_principalTransactionId_key" ON "LiabilityPayment"("principalTransactionId");
CREATE UNIQUE INDEX IF NOT EXISTS "LiabilityPayment_expenseTransactionId_key" ON "LiabilityPayment"("expenseTransactionId");
CREATE UNIQUE INDEX IF NOT EXISTS "LiabilityPayment_workspaceId_idempotencyKey_key" ON "LiabilityPayment"("workspaceId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "NetWorthSnapshot_workspaceId_asOfDate_idx" ON "NetWorthSnapshot"("workspaceId", "asOfDate");
CREATE INDEX IF NOT EXISTS "FinancialAuditLog_workspaceId_createdAt_idx" ON "FinancialAuditLog"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "FinancialAuditLog_entityType_entityId_idx" ON "FinancialAuditLog"("entityType", "entityId");

DO $$ BEGIN
  ALTER TABLE "InvestmentPosition" ADD CONSTRAINT "InvestmentPosition_linkedAccountId_fkey" FOREIGN KEY ("linkedAccountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LiabilityPayment" ADD CONSTRAINT "LiabilityPayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LiabilityPayment" ADD CONSTRAINT "LiabilityPayment_principalTransactionId_fkey" FOREIGN KEY ("principalTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LiabilityPayment" ADD CONSTRAINT "LiabilityPayment_expenseTransactionId_fkey" FOREIGN KEY ("expenseTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "NetWorthSnapshot" ADD CONSTRAINT "NetWorthSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FinancialAuditLog" ADD CONSTRAINT "FinancialAuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_limitAmount_positive" CHECK ("limitAmount" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FinancialLiability" ADD CONSTRAINT "FinancialLiability_outstanding_nonneg" CHECK ("outstandingBalance" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LiabilityPayment" ADD CONSTRAINT "LiabilityPayment_principal_nonneg" CHECK ("principalAmount" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LiabilityPayment" ADD CONSTRAINT "LiabilityPayment_interest_nonneg" CHECK ("interestAmount" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LiabilityPayment" ADD CONSTRAINT "LiabilityPayment_fees_nonneg" CHECK ("feesAmount" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
