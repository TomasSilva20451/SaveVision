import { decimal } from "@/lib/finance/money";

export function parsePaymentDueDayOfMonth(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 31) return null;
  return n;
}

/** Valida dia civil de vencimento (1–31); meses curtos clamp no motor de agenda. */
export function validatePaymentDueDayInput(raw: unknown): { ok: true; day: number | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, day: null };
  }
  const day = parsePaymentDueDayOfMonth(raw);
  if (day === null) {
    return { ok: false, error: "Dia de vencimento inválido (use 1–31)." };
  }
  return { ok: true, day };
}

export type RecurringLiabilityLinkInput = {
  recurringStatus: string;
  recurringFrequency: string;
  recurringAmount: string;
  linkedLiabilityId: string | null;
  liabilityMonthlyPayment: string | null;
  liabilityOutstanding: string;
};

export function describeRecurringLiabilityMismatch(
  input: RecurringLiabilityLinkInput,
): string | null {
  if (!input.linkedLiabilityId) return null;
  if (input.recurringStatus !== "ACTIVE") {
    return "Recorrência pausada ou terminada: o passivo voltará a aparecer nas previsões se tiver vencimento definido.";
  }
  if (input.recurringFrequency !== "MONTHLY") {
    return "Associação a passivo com prestação mensal: a periodicidade da recorrência não é mensal — reveja a configuração.";
  }
  if (input.liabilityMonthlyPayment == null) {
    return "Passivo associado sem prestação mensal registada.";
  }
  if (decimal(input.liabilityOutstanding).lte(0)) {
    return "Passivo associado já está liquidado (saldo zero).";
  }
  const rec = decimal(input.recurringAmount).abs();
  const li = decimal(input.liabilityMonthlyPayment).abs();
  if (!rec.eq(li)) {
    return `Montante da recorrência (${rec.toFixed(2)} €) difere da prestação do passivo (${li.toFixed(2)} €).`;
  }
  return null;
}

export function assertSingleActiveLinkPerLiability(
  links: readonly { liabilityId: string; recurringId: string; status: string }[],
  candidateLiabilityId: string,
  candidateRecurringId: string,
): string | null {
  for (const row of links) {
    if (row.liabilityId !== candidateLiabilityId) continue;
    if (row.status !== "ACTIVE") continue;
    if (row.recurringId === candidateRecurringId) continue;
    return "Este passivo já tem outra recorrência activa associada.";
  }
  return null;
}
