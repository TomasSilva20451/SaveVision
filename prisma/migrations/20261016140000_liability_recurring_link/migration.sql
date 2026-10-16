-- Ligação explícita recorrência ↔ passivo (evita dupla contagem no forecast).
-- Dia de vencimento opcional do passivo (sem data não se projecta caixa).
ALTER TABLE "RecurringExpense" ADD COLUMN "linkedLiabilityId" TEXT;
ALTER TABLE "FinancialLiability" ADD COLUMN "paymentDueDayOfMonth" INTEGER;

ALTER TABLE "RecurringExpense"
  ADD CONSTRAINT "RecurringExpense_linkedLiabilityId_fkey"
  FOREIGN KEY ("linkedLiabilityId") REFERENCES "FinancialLiability"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "RecurringExpense_workspaceId_linkedLiabilityId_idx"
  ON "RecurringExpense"("workspaceId", "linkedLiabilityId");
