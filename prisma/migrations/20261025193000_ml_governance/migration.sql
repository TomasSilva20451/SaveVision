CREATE TABLE "MlFeatureControl" (
    "capability" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "killSwitch" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MlFeatureControl_pkey" PRIMARY KEY ("capability")
);

CREATE TABLE "MlInvocationEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "userId" TEXT,
    "capability" TEXT NOT NULL,
    "modelKey" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "promptKey" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "estimatedInputTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedOutputTokens" INTEGER NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION,
    "inputHash" TEXT NOT NULL,
    "outputHash" TEXT,
    "promptExcerpt" TEXT,
    "promptExpiresAt" TIMESTAMP(3),
    "fallbackReason" TEXT,
    "humanReviewRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MlInvocationEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MlEvaluationRun" (
    "id" TEXT NOT NULL,
    "suiteVersion" TEXT NOT NULL,
    "releaseRef" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "datasetChecksums" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "MlEvaluationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MlDriftSnapshot" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "capability" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "sampleCount" INTEGER NOT NULL,
    "coverage" DOUBLE PRECISION NOT NULL,
    "meanConfidence" DOUBLE PRECISION,
    "correctionRate" DOUBLE PRECISION,
    "driftScore" DOUBLE PRECISION,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MlDriftSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MlInvocationEvent_capability_createdAt_idx" ON "MlInvocationEvent"("capability", "createdAt");
CREATE INDEX "MlInvocationEvent_workspaceId_createdAt_idx" ON "MlInvocationEvent"("workspaceId", "createdAt");
CREATE INDEX "MlInvocationEvent_outcome_createdAt_idx" ON "MlInvocationEvent"("outcome", "createdAt");
CREATE INDEX "MlEvaluationRun_status_startedAt_idx" ON "MlEvaluationRun"("status", "startedAt");
CREATE INDEX "MlEvaluationRun_releaseRef_idx" ON "MlEvaluationRun"("releaseRef");
CREATE INDEX "MlDriftSnapshot_capability_periodKey_idx" ON "MlDriftSnapshot"("capability", "periodKey");
CREATE INDEX "MlDriftSnapshot_workspaceId_createdAt_idx" ON "MlDriftSnapshot"("workspaceId", "createdAt");
