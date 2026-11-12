-- CreateTable
CREATE TABLE "LoginMfaChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "mfaGate" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "ipHash" TEXT,
    "deviceHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginMfaChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoginMfaChallenge_tokenHash_key" ON "LoginMfaChallenge"("tokenHash");

-- CreateIndex
CREATE INDEX "LoginMfaChallenge_userId_createdAt_idx" ON "LoginMfaChallenge"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LoginMfaChallenge_expiresAt_idx" ON "LoginMfaChallenge"("expiresAt");

-- AddForeignKey
ALTER TABLE "LoginMfaChallenge" ADD CONSTRAINT "LoginMfaChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
