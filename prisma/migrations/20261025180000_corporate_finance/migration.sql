-- CreateEnum
CREATE TYPE "OpenBankingConsentStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED');
CREATE TYPE "BankFeedLineStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'IGNORED', 'DUPLICATE');
CREATE TYPE "ReconciliationMatchMethod" AS ENUM ('AUTO', 'MANUAL');
CREATE TYPE "FinancialApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "SupportCaseStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

CREATE TABLE "OpenBankingConsent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "consentRef" TEXT NOT NULL,
    "status" "OpenBankingConsentStatus" NOT NULL DEFAULT 'PENDING',
    "scopes" TEXT[] DEFAULT ARRAY['accounts:read', 'transactions:read']::TEXT[],
    "readOnly" BOOLEAN NOT NULL DEFAULT true,
    "grantedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenBankingConsent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankFeedLine" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "bookingDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "description" TEXT,
    "counterpartyHash" TEXT,
    "status" "BankFeedLineStatus" NOT NULL DEFAULT 'UNMATCHED',
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duplicateOfId" TEXT,

    CONSTRAINT "BankFeedLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankReconciliationMatch" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "bankFeedLineId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "matchedByUserId" TEXT,
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" DOUBLE PRECISION NOT NULL,
    "method" "ReconciliationMatchMethod" NOT NULL,

    CONSTRAINT "BankReconciliationMatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialApproval" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "status" "FinancialApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "actionType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "FinancialApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookSubscription" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "events" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportCase" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "SupportCaseStatus" NOT NULL DEFAULT 'OPEN',
    "disputeRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SupportCase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OpenBankingConsent_workspaceId_accountId_provider_key" ON "OpenBankingConsent"("workspaceId", "accountId", "provider");
CREATE INDEX "OpenBankingConsent_workspaceId_status_idx" ON "OpenBankingConsent"("workspaceId", "status");

CREATE UNIQUE INDEX "BankFeedLine_workspaceId_externalId_key" ON "BankFeedLine"("workspaceId", "externalId");
CREATE INDEX "BankFeedLine_workspaceId_accountId_status_bookingDate_idx" ON "BankFeedLine"("workspaceId", "accountId", "status", "bookingDate");

CREATE UNIQUE INDEX "BankReconciliationMatch_bankFeedLineId_key" ON "BankReconciliationMatch"("bankFeedLineId");
CREATE UNIQUE INDEX "BankReconciliationMatch_transactionId_key" ON "BankReconciliationMatch"("transactionId");
CREATE INDEX "BankReconciliationMatch_workspaceId_matchedAt_idx" ON "BankReconciliationMatch"("workspaceId", "matchedAt");

CREATE INDEX "FinancialApproval_workspaceId_status_createdAt_idx" ON "FinancialApproval"("workspaceId", "status", "createdAt");
CREATE INDEX "WebhookSubscription_workspaceId_active_idx" ON "WebhookSubscription"("workspaceId", "active");
CREATE INDEX "SupportCase_workspaceId_status_createdAt_idx" ON "SupportCase"("workspaceId", "status", "createdAt");

ALTER TABLE "OpenBankingConsent" ADD CONSTRAINT "OpenBankingConsent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpenBankingConsent" ADD CONSTRAINT "OpenBankingConsent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BankFeedLine" ADD CONSTRAINT "BankFeedLine_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankFeedLine" ADD CONSTRAINT "BankFeedLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankFeedLine" ADD CONSTRAINT "BankFeedLine_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "BankFeedLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BankReconciliationMatch" ADD CONSTRAINT "BankReconciliationMatch_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationMatch" ADD CONSTRAINT "BankReconciliationMatch_bankFeedLineId_fkey" FOREIGN KEY ("bankFeedLineId") REFERENCES "BankFeedLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationMatch" ADD CONSTRAINT "BankReconciliationMatch_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinancialApproval" ADD CONSTRAINT "FinancialApproval_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebhookSubscription" ADD CONSTRAINT "WebhookSubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
