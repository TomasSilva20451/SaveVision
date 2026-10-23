-- Consentimentos versionados e pedidos de eliminação verificável (RGPD)

CREATE TABLE "PrivacyConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentKey" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT,
    "userAgentHash" TEXT,

    CONSTRAINT "PrivacyConsent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivacyConsent_userId_consentKey_version_key" ON "PrivacyConsent"("userId", "consentKey", "version");
CREATE INDEX "PrivacyConsent_userId_acceptedAt_idx" ON "PrivacyConsent"("userId", "acceptedAt");

ALTER TABLE "PrivacyConsent" ADD CONSTRAINT "PrivacyConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SubjectErasureRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "proofSha256" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "SubjectErasureRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubjectErasureRequest_userId_requestedAt_idx" ON "SubjectErasureRequest"("userId", "requestedAt");

ALTER TABLE "SubjectErasureRequest" ADD CONSTRAINT "SubjectErasureRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
