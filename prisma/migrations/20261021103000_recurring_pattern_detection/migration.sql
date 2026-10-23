CREATE TABLE "RecurringPatternSuggestionDismissal" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "suggestionKey" TEXT NOT NULL,
    "merchantPattern" TEXT NOT NULL,
    "dismissedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringPatternSuggestionDismissal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecurringPatternMerchantBlock" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "merchantPattern" TEXT NOT NULL,
    "blockedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringPatternMerchantBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecurringPatternSuggestionDismissal_workspaceId_suggestionKey_key"
ON "RecurringPatternSuggestionDismissal"("workspaceId", "suggestionKey");

CREATE INDEX "RecurringPatternSuggestionDismissal_workspaceId_merchantPattern_idx"
ON "RecurringPatternSuggestionDismissal"("workspaceId", "merchantPattern");

CREATE UNIQUE INDEX "RecurringPatternMerchantBlock_workspaceId_merchantPattern_key"
ON "RecurringPatternMerchantBlock"("workspaceId", "merchantPattern");

ALTER TABLE "RecurringPatternSuggestionDismissal"
ADD CONSTRAINT "RecurringPatternSuggestionDismissal_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecurringPatternMerchantBlock"
ADD CONSTRAINT "RecurringPatternMerchantBlock_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
