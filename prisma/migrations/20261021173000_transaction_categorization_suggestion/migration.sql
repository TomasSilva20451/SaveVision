-- CreateEnum
CREATE TYPE "CategorizationSuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
CREATE TYPE "CategorizationSuggestionSource" AS ENUM ('RULE', 'OLLAMA');

-- CreateTable
CREATE TABLE "TransactionCategorizationSuggestion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "suggestedCategoryId" TEXT,
    "suggestedMerchant" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "source" "CategorizationSuggestionSource" NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "CategorizationSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "rejectedUntil" TIMESTAMP(3),
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedByUserId" TEXT,

    CONSTRAINT "TransactionCategorizationSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransactionCategorizationSuggestion_transactionId_key" ON "TransactionCategorizationSuggestion"("transactionId");
CREATE INDEX "TransactionCategorizationSuggestion_workspaceId_status_computedAt_idx" ON "TransactionCategorizationSuggestion"("workspaceId", "status", "computedAt");

-- AddForeignKey
ALTER TABLE "TransactionCategorizationSuggestion" ADD CONSTRAINT "TransactionCategorizationSuggestion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransactionCategorizationSuggestion" ADD CONSTRAINT "TransactionCategorizationSuggestion_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransactionCategorizationSuggestion" ADD CONSTRAINT "TransactionCategorizationSuggestion_suggestedCategoryId_fkey" FOREIGN KEY ("suggestedCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
