export const platformJobKinds = ["REPORT_EXPORT", "RECEIPT_OCR", "ML_CATEGORIZATION", "WEBHOOK_DELIVERY"] as const;
export type PlatformJobKind = (typeof platformJobKinds)[number];

/** Limites de concorrência por tipo. OCR é o mais pesado. */
export const JOB_CONCURRENCY: Record<PlatformJobKind, number> = {
  REPORT_EXPORT: 2,
  RECEIPT_OCR: 1,
  ML_CATEGORIZATION: 2,
  WEBHOOK_DELIVERY: 4,
};

export const GLOBAL_JOB_CONCURRENCY = 4;

export function kindsWithCapacity(
  runningByKind: Partial<Record<PlatformJobKind, number>>,
): PlatformJobKind[] {
  const runningTotal = platformJobKinds.reduce((sum, kind) => sum + (runningByKind[kind] ?? 0), 0);
  if (runningTotal >= GLOBAL_JOB_CONCURRENCY) return [];
  return platformJobKinds.filter((kind) => (runningByKind[kind] ?? 0) < JOB_CONCURRENCY[kind]);
}

export function recommendReplicas(input: {
  peakRequestsPerSecond: number;
  requestsPerReplica: number;
  minimum: number;
  maximum: number;
}): number {
  if (input.requestsPerReplica <= 0) throw new Error("requestsPerReplica tem de ser positivo.");
  if (input.minimum < 1 || input.maximum < input.minimum) throw new Error("Intervalo de réplicas inválido.");
  const needed = Math.ceil(input.peakRequestsPerSecond / input.requestsPerReplica);
  return Math.min(input.maximum, Math.max(input.minimum, needed));
}

export function rolloutDecision(healthOk: boolean): "promote" | "rollback" {
  return healthOk ? "promote" : "rollback";
}
