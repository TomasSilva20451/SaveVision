CREATE TYPE "DocumentIntegrityStatus" AS ENUM ('OK', 'UNAVAILABLE');

ALTER TABLE "StoredDocument" ADD COLUMN "integrityStatus" "DocumentIntegrityStatus" NOT NULL DEFAULT 'OK';
ALTER TABLE "StoredDocument" ADD COLUMN "integrityReason" TEXT;
ALTER TABLE "StoredDocument" ADD COLUMN "integrityCheckedAt" TIMESTAMP(3);

CREATE INDEX "StoredDocument_integrityStatus_idx" ON "StoredDocument"("integrityStatus");
