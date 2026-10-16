/** Janela em dias para evidência fiável de pagamento duplicado (ligação explícita recorrência ↔ passivo). */
export const LINKED_PAYMENT_DUPLICATE_WINDOW_DAYS = 14;

export const LINKED_LIABILITY_ACK_FIELD = "acknowledgeLinkedLiabilityRisk";

export function linkedRecurringConfirmWarning(
  recurringName: string,
  liabilityTitle: string,
): string {
  return (
    `«${recurringName}» está associada ao passivo «${liabilityTitle}». ` +
    "Confirmar aqui cria um movimento bancário na recorrência. Se também registares um pagamento " +
    "bancário do passivo, podes duplicar a saída de caixa. Marca a confirmação explícita para continuar."
  );
}

export function linkedLiabilityBankPaymentWarning(
  liabilityTitle: string,
  recurringName: string,
  paidAtLabel: string,
): string {
  return (
    `Foi confirmada recentemente a recorrência «${recurringName}» com movimento bancário ` +
    `(${paidAtLabel}). Registar pagamento WITH_BANK para «${liabilityTitle}» pode duplicar a saída. ` +
    "Confirma que compreendes o risco para continuar."
  );
}

export function isWithinDuplicateEvidenceWindow(
  reference: Date,
  candidate: Date,
  windowDays: number = LINKED_PAYMENT_DUPLICATE_WINDOW_DAYS,
): boolean {
  const ref = reference.getTime();
  const cand = candidate.getTime();
  const windowMs = windowDays * 86_400_000;
  return Math.abs(ref - cand) <= windowMs;
}
