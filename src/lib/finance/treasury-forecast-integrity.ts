/**
 * Passivos cuja prestação já entra via despesa recorrente ligada
 * não devem gerar eventos de forecast adicionais.
 */
export function liabilityIdsSuppressedByRecurring(
  recurringLinks: readonly { linkedLiabilityId: string | null; status: string }[],
): Set<string> {
  const ids = new Set<string>();
  for (const row of recurringLinks) {
    if (row.status !== "ACTIVE") continue;
    if (row.linkedLiabilityId) ids.add(row.linkedLiabilityId);
  }
  return ids;
}
