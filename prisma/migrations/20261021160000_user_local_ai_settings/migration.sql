-- CreateTable
CREATE TABLE "UserLocalAiSettings" (
    "userId" TEXT NOT NULL,
    "localAiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ollamaBaseUrl" VARCHAR(512),
    "textModel" VARCHAR(128),
    "imageModel" VARCHAR(128),
    "helpModel" VARCHAR(128),
    "storePrompts" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLocalAiSettings_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "UserLocalAiSettings" ADD CONSTRAINT "UserLocalAiSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
