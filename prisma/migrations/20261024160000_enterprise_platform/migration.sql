-- Papel de suporte: vê a fila, não altera dados financeiros.
ALTER TYPE "SystemRole" ADD VALUE IF NOT EXISTS 'SUPPORT';

CREATE TYPE "PlatformJobKind" AS ENUM ('REPORT_EXPORT', 'RECEIPT_OCR', 'ML_CATEGORIZATION');
CREATE TYPE "PlatformJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

CREATE TABLE "PlatformJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "requestedById" TEXT,
    "kind" "PlatformJobKind" NOT NULL,
    "status" "PlatformJobStatus" NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lockedBy" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "PlatformJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformJob_status_availableAt_idx" ON "PlatformJob"("status", "availableAt");
CREATE INDEX "PlatformJob_kind_status_idx" ON "PlatformJob"("kind", "status");
CREATE INDEX "PlatformJob_workspaceId_idx" ON "PlatformJob"("workspaceId");

ALTER TABLE "PlatformJob" ADD CONSTRAINT "PlatformJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
