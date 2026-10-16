import { addMoney, decimal } from "@/lib/finance/money";
import type { AccountSnapshot, LedgerMovement } from "@/lib/finance/types";

function isActiveMovement(movement: LedgerMovement): boolean {
  return movement.status === "COMPLETED" && movement.deletedAt == null;
}

export function signedMovementAmount(movement: LedgerMovement) {
  if (!isActiveMovement(movement)) {
    return decimal(0);
  }

  return decimal(movement.amount);
}

export function calculateAccountBalance(
  openingBalance: string,
  movements: readonly LedgerMovement[],
  accountId: string,
) {
  const relevant = movements.filter(
    (movement) => movement.accountId === accountId && isActiveMovement(movement),
  );

  return addMoney([
    openingBalance,
    ...relevant.map((movement) => signedMovementAmount(movement)),
  ]);
}

export function calculateIncome(movements: readonly LedgerMovement[]) {
  return addMoney(
    movements
      .filter(
        (movement) =>
          movement.type === "INCOME" && isActiveMovement(movement),
      )
      .map((movement) => movement.amount),
  );
}

export function calculateExpectedIncome(movements: readonly LedgerMovement[]) {
  return addMoney(
    movements
      .filter(
        (movement) =>
          movement.type === "INCOME" &&
          movement.status === "EXPECTED" &&
          movement.deletedAt == null,
      )
      .map((movement) => movement.amount),
  );
}

export function calculateExpenses(movements: readonly LedgerMovement[]) {
  return addMoney(
    movements
      .filter(
        (movement) =>
          movement.type === "EXPENSE" && isActiveMovement(movement),
      )
      .map((movement) => decimal(movement.amount).abs()),
  );
}

/** Resultado económico: receitas realizadas − despesas realizadas (sem amortização de capital). */
export function calculateCashFlow(movements: readonly LedgerMovement[]) {
  return calculateIncome(movements).minus(calculateExpenses(movements));
}

/** Movimento de caixa: soma algébrica de INCOME, EXPENSE e ADJUSTMENT concluídos. */
export function calculateNetCashMovement(movements: readonly LedgerMovement[]) {
  return addMoney(
    movements
      .filter(
        (movement) =>
          isActiveMovement(movement) &&
          (movement.type === "INCOME" ||
            movement.type === "EXPENSE" ||
            movement.type === "ADJUSTMENT"),
      )
      .map((movement) => signedMovementAmount(movement)),
  );
}

export function calculateNetWorth(
  accounts: readonly AccountSnapshot[],
  movements: readonly LedgerMovement[],
) {
  return accounts
    .filter((account) => !account.isArchived && account.isIncludedInNetWorth)
    .reduce((total, account) => {
      const balance = calculateAccountBalance(
        account.openingBalance,
        movements,
        account.id,
      );
      const contribution =
        account.type === "LIABILITY" ? balance.negated() : balance;

      return total.plus(contribution);
    }, decimal(0));
}
