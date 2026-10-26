-- AlterEnum
ALTER TYPE "BankFeedLineStatus" ADD VALUE 'EXCEPTION';

-- AlterEnum
ALTER TYPE "PlatformJobKind" ADD VALUE 'WEBHOOK_DELIVERY';

-- CreateTable
CREATE TABLE "ReconciliationDayClose" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "civilDate" TEXT NOT NULL,
    "closedByUserId" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unmatchedCount" INTEGER NOT NULL,
    "exceptionCount" INTEGER NOT NULL,
    "autoMatchRate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ReconciliationDayClose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationDayClose_workspaceId_civilDate_key" ON "ReconciliationDayClose"("workspaceId", "civilDate");

-- CreateIndex
CREATE INDEX "ReconciliationDayClose_workspaceId_closedAt_idx" ON "ReconciliationDayClose"("workspaceId", "closedAt");

-- AddForeignKey
ALTER TABLE "ReconciliationDayClose" ADD CONSTRAINT "ReconciliationDayClose_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
