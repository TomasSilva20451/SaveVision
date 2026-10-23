import "server-only";
import { CRITICAL_JOURNEYS } from "@/lib/observability/journeys";
import { log } from "@/lib/observability/logger";
import { recordTransactionMetric } from "@/lib/observability/metrics";

export function observeTransactionPersisted(kind: "expense" | "income" | "transfer") {
  recordTransactionMetric(kind);
  log.info("finance.transaction_persisted", {
    journey: CRITICAL_JOURNEYS.transactionWrite,
    event: "transaction_persisted",
    meta: { kind },
  });
}
