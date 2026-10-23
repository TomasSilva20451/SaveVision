/** Retenção e eliminação por categoria (dias). Ver docs/PRIVACY_GOVERNANCE.md */

export const RETENTION_DAYS: Record<string, number | null> = {
  account_profile: null,
  financial_transactions: 3650,
  documents: 3650,
  security_events: 730,
  auth_sessions_revoked: 90,
  email_challenges_consumed: 30,
  local_ai_prompt_cache: 7,
  audit_ledger: null,
  backup_encrypted: 30,
};

export function retentionLabel(category: string): string {
  const days = RETENTION_DAYS[category];
  if (days === null) return "Enquanto a conta estiver activa (+ obrigações legais)";
  if (days >= 365) return `${Math.round(days / 365)} anos`;
  return `${days} dias`;
}
