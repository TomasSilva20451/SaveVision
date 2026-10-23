/** Política de retenção e segurança para backups (sem I/O). */

export const BACKUP_POLICY = {
  /** Cópias lógicas diárias + WAL quando PITR activo. */
  rpoMinutesWithPitr: 15,
  rpoHoursDumpOnly: 24,
  /** Tempo alvo para restabelecer serviço crítico (BD + app). */
  rtoHoursPostgres: 4,
  rtoHoursApp: 1,
  rtoHoursDocuments: 4,
  /** Ollama é opcional; a app degrada sem parar. */
  rtoHoursOllama: null,
  defaultRetentionDays: 30,
  walRetentionDays: 14,
  /** 3-2-1: 3 cópias, 2 suportes, 1 off-site (documentado em docs/BUSINESS_CONTINUITY.md). */
  copies321: { copies: 3, mediaTypes: 2, offSite: 1 },
};

export function backupRoot(cwd = process.cwd()) {
  return `${cwd}/storage/backups`;
}

export function isEncryptionConfigured(env = process.env) {
  const secret = env.FINTWIN_BACKUP_ENCRYPTION_SECRET?.trim();
  return Boolean(secret && secret.length >= 32);
}

export function assertBackupSecurity(env = process.env) {
  const environment = env.FINTWIN_ENV ?? "development";
  if (environment !== "staging" && environment !== "production") return;
  if (!isEncryptionConfigured(env)) throw new Error(`${environment} exige backup cifrado.`);
  if (!env.FINTWIN_BACKUP_ENCRYPTION_KEY_ID?.startsWith(`${environment}-`)) {
    throw new Error(`${environment} exige um key id de backup próprio do ambiente.`);
  }
  if (env.FINTWIN_BACKUP_DELETE_PLAINTEXT !== "yes") {
    throw new Error(`${environment} exige remoção imediata do dump em claro.`);
  }
}

export function isOffsiteConfigured(env = process.env) {
  return Boolean(env.FINTWIN_BACKUP_OFFSITE_COMMAND?.trim());
}

export function retentionDays(env = process.env) {
  const raw = env.FINTWIN_BACKUP_RETENTION_DAYS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : BACKUP_POLICY.defaultRetentionDays;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : BACKUP_POLICY.defaultRetentionDays;
}

/** Nomes de bases temporárias permitidas para drills. */
export function isAllowedDrillDatabaseName(name) {
  return /^fintwin_(drill|restore_test)(_[a-z0-9]+)?$/i.test(name);
}

export function assertBackupDrillAllowed(env = process.env) {
  if (env.FINTWIN_BACKUP_DRILL === "yes") return;
  const environment = env.FINTWIN_ENV ?? "development";
  if (environment === "development" || environment === "e2e" || environment === "demo") return;
  throw new Error(
    "Drill de restauro bloqueado em staging/produção. Usa FINTWIN_BACKUP_DRILL=yes numa janela controlada ou ambiente local.",
  );
}

export function filesToPrune(fileNames, nowMs, keepDays) {
  const cutoff = nowMs - keepDays * 86_400_000;
  return fileNames.filter((name) => {
    const match = name.match(/(\d{8})-(\d{6})/);
    if (!match) return false;
    const stamp = Date.parse(`${match[1].slice(0, 4)}-${match[1].slice(4, 6)}-${match[1].slice(6, 8)}T${match[2].slice(0, 2)}:${match[2].slice(2, 4)}:${match[2].slice(4, 6)}Z`);
    return Number.isFinite(stamp) && stamp < cutoff;
  });
}
