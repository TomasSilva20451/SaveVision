CREATE TABLE "TransactionCategorizationRule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "merchant" TEXT NOT NULL,
    "categoryId" TEXT,
    "transactionType" "TransactionType" NOT NULL,
    "nature" "CategoryNature",
    "appliedCount" INTEGER NOT NULL DEFAULT 1,
    "correctionCount" INTEGER NOT NULL DEFAULT 0,
    "lastConfirmedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionCategorizationRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TransactionCategorizationRule_workspaceId_pattern_transactionType_key"
ON "TransactionCategorizationRule"("workspaceId", "pattern", "transactionType");

CREATE INDEX "TransactionCategorizationRule_workspaceId_updatedAt_idx"
ON "TransactionCategorizationRule"("workspaceId", "updatedAt");

ALTER TABLE "TransactionCategorizationRule"
ADD CONSTRAINT "TransactionCategorizationRule_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TransactionCategorizationRule"
ADD CONSTRAINT "TransactionCategorizationRule_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
