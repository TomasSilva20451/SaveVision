import { DEFERRED_HIGH_RISK_ML } from "@/lib/ml/registry";

const deferred = new Set<string>(DEFERRED_HIGH_RISK_ML);

/** Bloqueia capacidades de alto risco regulatório ainda fora de âmbito. */
export function assertMlCapabilityNotDeferred(capability: string): void {
  if (deferred.has(capability)) {
    throw new Error(`ML_CAPABILITY_DEFERRED:${capability}`);
  }
}

export function isDeferredMlCapability(capability: string): boolean {
  return deferred.has(capability);
}
