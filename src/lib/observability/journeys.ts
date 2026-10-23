/** Jornadas críticas para SLOs e dashboards (docs/SLO.md). */
export const CRITICAL_JOURNEYS = {
  login: "login",
  dashboard: "dashboard",
  transactionWrite: "transaction_write",
  reportExport: "report_export",
  backupJob: "backup_job",
} as const;

export type CriticalJourney = (typeof CRITICAL_JOURNEYS)[keyof typeof CRITICAL_JOURNEYS];
