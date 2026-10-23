-- CreateTable
CREATE TABLE "MonthlyReportNarrative" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "sourceFactsJson" JSONB NOT NULL,
    "narrativeText" TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyReportNarrative_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonthlyReportNarrative_workspaceId_periodKey_generatedAt_idx" ON "MonthlyReportNarrative"("workspaceId", "periodKey", "generatedAt");

-- AddForeignKey
ALTER TABLE "MonthlyReportNarrative" ADD CONSTRAINT "MonthlyReportNarrative_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyReportNarrative" ADD CONSTRAINT "MonthlyReportNarrative_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
