-- Ancla de calendário imutável; dueDate pode mudar com adiamentos.
ALTER TABLE "RecurringExpenseOccurrence" ADD COLUMN IF NOT EXISTS "anchorDate" TIMESTAMP(3);

UPDATE "RecurringExpenseOccurrence" SET "anchorDate" = "dueDate" WHERE "anchorDate" IS NULL;

ALTER TABLE "RecurringExpenseOccurrence" ALTER COLUMN "anchorDate" SET NOT NULL;

DROP INDEX IF EXISTS "RecurringExpenseOccurrence_recurringExpenseId_dueDate_key";

CREATE UNIQUE INDEX IF NOT EXISTS "RecurringExpenseOccurrence_recurringExpenseId_anchorDate_key"
  ON "RecurringExpenseOccurrence"("recurringExpenseId", "anchorDate");
