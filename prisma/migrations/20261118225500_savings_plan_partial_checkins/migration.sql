ALTER TABLE "SavingsPlanCheckIn"
ADD COLUMN "contributedAmount" DECIMAL(19,4) NOT NULL DEFAULT 0;

UPDATE "SavingsPlanCheckIn" AS check_in
SET "contributedAmount" = contribution."amount"
FROM "SavingsGoalContribution" AS contribution
WHERE check_in."contributionId" = contribution."id";

UPDATE "SavingsPlanCheckIn"
SET
  "status" = 'DUE',
  "completedAt" = NULL
WHERE
  "status" = 'COMPLETED'
  AND "contributedAmount" < "expectedAmount";
