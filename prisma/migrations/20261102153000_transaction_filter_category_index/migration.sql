-- Lista de transacoes: filtros frequentes por workspace, intervalo occurredAt e categoryId (ver getTransactionsPage).
CREATE INDEX "Transaction_workspaceId_occurredAt_categoryId_idx" ON "Transaction"("workspaceId", "occurredAt", "categoryId");
