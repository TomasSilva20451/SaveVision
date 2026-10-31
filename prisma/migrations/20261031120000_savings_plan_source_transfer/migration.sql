-- AlterTable
ALTER TABLE "SavingsPlan" ADD COLUMN "sourceAccountId" TEXT;

-- AlterTable
ALTER TABLE "SavingsGoalContribution" ADD COLUMN "transferId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SavingsGoalContribution_transferId_key" ON "SavingsGoalContribution"("transferId");

-- AddForeignKey
ALTER TABLE "SavingsPlan" ADD CONSTRAINT "SavingsPlan_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsGoalContribution" ADD CONSTRAINT "SavingsGoalContribution_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
