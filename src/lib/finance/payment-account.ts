export type PaymentAccountOption = {
  id: string;
  name: string;
  type: string;
};

const PAYMENT_PRIORITY: Record<string, number> = {
  CURRENT: 0,
  CASH: 1,
  OTHER: 2,
  INVESTMENT: 3,
  CRYPTO: 4,
  SAVINGS: 5,
  LIABILITY: 6,
};

export function sortPaymentAccounts<T extends PaymentAccountOption>(accounts: T[]): T[] {
  return [...accounts].sort((left, right) => {
    const priority = (PAYMENT_PRIORITY[left.type] ?? 99) - (PAYMENT_PRIORITY[right.type] ?? 99);
    return priority || left.name.localeCompare(right.name, "pt-PT");
  });
}

export function preferredPaymentAccountId(
  accounts: PaymentAccountOption[],
  configuredAccountId?: string | null,
): string {
  if (configuredAccountId && accounts.some((account) => account.id === configuredAccountId)) {
    return configuredAccountId;
  }

  return sortPaymentAccounts(accounts)[0]?.id ?? "";
}

export function paymentAccountLabel(account: PaymentAccountOption): string {
  return account.type === "SAVINGS"
    ? `${account.name} (poupança — evitar para pagamentos)`
    : account.name;
}
