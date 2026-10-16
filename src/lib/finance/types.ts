export type TransactionType =
  | "INCOME"
  | "EXPENSE"
  | "TRANSFER"
  | "ADJUSTMENT";

export type TransactionStatus =
  | "PENDING"
  | "EXPECTED"
  | "COMPLETED"
  | "CANCELLED";

export type LedgerMovement = {
  accountId: string;
  type: TransactionType;
  status: TransactionStatus;
  /** Montante com sinal: positivo aumenta o saldo da conta, negativo diminui. */
  amount: string;
  deletedAt?: Date | null;
};

export type AccountSnapshot = {
  id: string;
  openingBalance: string;
  type: string;
  isIncludedInNetWorth: boolean;
  isArchived: boolean;
};
