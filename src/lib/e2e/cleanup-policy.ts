export type E2eCleanupDecision = {
  allowed: boolean;
  reason: string;
};

const BLOCKED_DB_NAME_PATTERN = /(backup|restore|prod|production|primary|replica)/i;

const E2E_DB_SUFFIX = /_e2e$/i;

/** Base demo Docker Compose: postgres local na porta 5433. */
function isLocalDockerDemoDatabase(host: string, port: string, database: string): boolean {
  const localHost = host === "localhost" || host === "127.0.0.1";
  return localHost && port === "5433" && database === "fintwin";
}

function isDedicatedE2eDatabaseName(database: string): boolean {
  return database === "fintwin_e2e" || E2E_DB_SUFFIX.test(database);
}

function parseDatabaseUrl(connectionString: string): {
  host: string;
  port: string;
  database: string;
} | null {
  try {
    const url = new URL(connectionString.replace(/^postgresql:/, "postgres:"));
    const database = decodeURIComponent(url.pathname.replace(/^\//, "")).split("/")[0] ?? "";
    if (!database) return null;
    return {
      host: url.hostname.toLowerCase(),
      port: url.port || "5432",
      database: database.toLowerCase(),
    };
  } catch {
    return null;
  }
}

/**
 * Política fail-closed para limpeza de fixtures E2E.
 * `FINTWIN_ALLOW_E2E_CLEANUP=yes` só actua como confirmação adicional;
 * nunca substitui as regras de base de dados dedicada.
 */
export function evaluateE2eCleanupPolicy(input: {
  connectionString: string;
  nodeEnv?: string;
  allowFlag?: string;
  primaryDatabaseUrl?: string;
}): E2eCleanupDecision {
  const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV ?? "development";
  if (nodeEnv === "production") {
    return { allowed: false, reason: "NODE_ENV=production bloqueia limpeza E2E." };
  }

  const parsed = parseDatabaseUrl(input.connectionString.split("?")[0] ?? "");
  if (!parsed) {
    return { allowed: false, reason: "DATABASE_URL inválida ou sem nome de base." };
  }

  const { host, port, database } = parsed;

  if (BLOCKED_DB_NAME_PATTERN.test(database)) {
    return {
      allowed: false,
      reason: `Nome de base «${database}» corresponde a padrão bloqueado (backup/prod/primary).`,
    };
  }

  const primary = input.primaryDatabaseUrl ?? process.env.FINTWIN_PRIMARY_DATABASE_URL;
  if (primary) {
    const primaryParsed = parseDatabaseUrl(primary.split("?")[0] ?? "");
    if (
      primaryParsed &&
      primaryParsed.host === host &&
      primaryParsed.port === port &&
      primaryParsed.database === database
    ) {
      return {
        allowed: false,
        reason: "DATABASE_URL coincide com FINTWIN_PRIMARY_DATABASE_URL (base principal).",
      };
    }
  }

  const localHost = host === "localhost" || host === "127.0.0.1";
  const localDockerDemo = isLocalDockerDemoDatabase(host, port, database);
  const localDedicated = localHost && isDedicatedE2eDatabaseName(database);

  if (!localDockerDemo && !localDedicated) {
    return {
      allowed: false,
      reason:
        `Base «${database}» em ${host}:${port} não é ambiente E2E local dedicado ` +
        `(esperado: fintwin@localhost:5433, fintwin_e2e ou *_e2e em localhost).`,
    };
  }

  if (!localDockerDemo) {
    const confirmed =
      input.allowFlag === "yes" || process.env.FINTWIN_ALLOW_E2E_CLEANUP === "yes";
    if (!confirmed) {
      return {
        allowed: false,
        reason:
          "Confirmação explícita em falta (FINTWIN_ALLOW_E2E_CLEANUP=yes) para bases _e2e locais.",
      };
    }
  }

  return { allowed: true, reason: "Ambiente E2E dedicado verificado." };
}

export function assertE2eCleanupAllowed(connectionString: string): void {
  const decision = evaluateE2eCleanupPolicy({ connectionString });
  if (!decision.allowed) {
    throw new Error(`[e2e cleanup] Bloqueado: ${decision.reason}`);
  }
}
