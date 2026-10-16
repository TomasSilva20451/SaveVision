-- AlterEnum
ALTER TYPE "RecurringFrequency" ADD VALUE IF NOT EXISTS 'SEMIANNUAL';

-- CreateEnum
CREATE TYPE "RecurringExpenseStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');
CREATE TYPE "RecurringExpenseOccurrenceStatus" AS ENUM ('EXPECTED', 'PAID', 'SKIPPED', 'POSTPONED', 'CANCELLED');

-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "expectedAmount" DECIMAL(19,4) NOT NULL,
    "frequency" "RecurringFrequency" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "dueDayOfMonth" INTEGER,
    "accountId" TEXT,
    "status" "RecurringExpenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "pausedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecurringExpenseOccurrence" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "recurringExpenseId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "expectedAmount" DECIMAL(19,4) NOT NULL,
    "actualAmount" DECIMAL(19,4),
    "status" "RecurringExpenseOccurrenceStatus" NOT NULL DEFAULT 'EXPECTED',
    "paidAt" TIMESTAMP(3),
    "transactionId" TEXT,
    "idempotencyKey" TEXT,
    "expectedAmountCustomized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringExpenseOccurrence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecurringExpenseOccurrence_transactionId_key" ON "RecurringExpenseOccurrence"("transactionId");
CREATE UNIQUE INDEX "RecurringExpenseOccurrence_recurringExpenseId_dueDate_key" ON "RecurringExpenseOccurrence"("recurringExpenseId", "dueDate");
CREATE UNIQUE INDEX "RecurringExpenseOccurrence_workspaceId_idempotencyKey_key" ON "RecurringExpenseOccurrence"("workspaceId", "idempotencyKey");
CREATE INDEX "RecurringExpenseOccurrence_workspaceId_dueDate_status_idx" ON "RecurringExpenseOccurrence"("workspaceId", "dueDate", "status");
CREATE INDEX "RecurringExpenseOccurrence_recurringExpenseId_status_idx" ON "RecurringExpenseOccurrence"("recurringExpenseId", "status");
CREATE INDEX "RecurringExpense_workspaceId_status_idx" ON "RecurringExpense"("workspaceId", "status");

ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecurringExpenseOccurrence" ADD CONSTRAINT "RecurringExpenseOccurrence_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringExpenseOccurrence" ADD CONSTRAINT "RecurringExpenseOccurrence_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringExpenseOccurrence" ADD CONSTRAINT "RecurringExpenseOccurrence_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_expectedAmount_nonneg" CHECK ("expectedAmount" >= 0);
