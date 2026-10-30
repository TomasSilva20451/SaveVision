const ENVIRONMENTS = {
  development: {
    databaseNames: ["fintwin", "fintwin_dev"],
    maySeed: false,
  },
  demo: {
    databaseNames: ["fintwin_demo_ui"],
    maySeed: true,
  },
  e2e: {
    databaseNames: ["fintwin_e2e"],
    maySeed: true,
  },
  staging: {
    databaseNames: ["fintwin_staging"],
    maySeed: false,
  },
  production: {
    databaseNames: ["fintwin_live", "fintwin_production"],
    maySeed: false,
  },
};

const RESERVED_DATABASE_OWNERS = new Map(
  Object.entries(ENVIRONMENTS).flatMap(([environment, policy]) =>
    policy.databaseNames.map((name) => [name, environment]),
  ),
);

export function databaseNameFromUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL não é um URL PostgreSQL válido.");
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("DATABASE_URL tem de usar postgresql:// ou postgres://.");
  }

  const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!name) throw new Error("DATABASE_URL não contém o nome da base de dados.");
  return { name, hostname: url.hostname, sslmode: url.searchParams.get("sslmode") };
}

export function validateEnvironment(input) {
  const environment = input.FINTWIN_ENV;
  const policy = ENVIRONMENTS[environment];
  if (!policy) {
    throw new Error(
      "FINTWIN_ENV inválido. Usa development, demo, e2e, staging ou production.",
    );
  }

  if (!input.DATABASE_URL) throw new Error("DATABASE_URL em falta.");
  const database = databaseNameFromUrl(input.DATABASE_URL);
  const explicitExpected = input.FINTWIN_EXPECTED_DATABASE;
  const reservedOwner = RESERVED_DATABASE_OWNERS.get(database.name);
  if (reservedOwner && reservedOwner !== environment) {
    throw new Error(
      `A base «${database.name}» está reservada ao ambiente ${reservedOwner}, não a ${environment}.`,
    );
  }
  const acceptedNames = explicitExpected
    ? [explicitExpected]
    : policy.databaseNames;

  if (!acceptedNames.includes(database.name)) {
    throw new Error(
      `A base «${database.name}» não pertence ao ambiente ${environment}. ` +
        `Esperado: ${acceptedNames.join(" ou ")}.`,
    );
  }

  if (
    (environment === "staging" || environment === "production") &&
    input.FINTWIN_SEED_PROFILE
  ) {
    throw new Error(`${environment} não permite FINTWIN_SEED_PROFILE.`);
  }

  if (
    policy.maySeed &&
    input.FINTWIN_SEED_PROFILE &&
    input.FINTWIN_SEED_PROFILE !== environment
  ) {
    throw new Error(
      `FINTWIN_SEED_PROFILE=${input.FINTWIN_SEED_PROFILE} não corresponde a ${environment}.`,
    );
  }

  if (environment === "e2e") {
    if (input.FINTWIN_ALLOW_E2E_CLEANUP !== "yes") {
      throw new Error("E2E exige FINTWIN_ALLOW_E2E_CLEANUP=yes.");
    }
    if (
      database.hostname !== "localhost" &&
      database.hostname !== "127.0.0.1" &&
      input.FINTWIN_ALLOW_REMOTE_E2E !== "yes"
    ) {
      throw new Error("E2E remoto está bloqueado por omissão.");
    }
    if (input.FINTWIN_PRIMARY_DATABASE_URL) {
      const primary = databaseNameFromUrl(input.FINTWIN_PRIMARY_DATABASE_URL);
      if (
        primary.name === database.name &&
        primary.hostname === database.hostname
      ) {
        throw new Error("A base E2E coincide com a base principal.");
      }
    }
  }

  if (
    (environment === "e2e" ||
      environment === "staging" ||
      environment === "production") &&
    (!input.AUTH_SECRET || input.AUTH_SECRET.length < 32)
  ) {
    throw new Error(`${environment} exige AUTH_SECRET com pelo menos 32 caracteres.`);
  }

  const stagingLocalDocker =
    environment === "staging" &&
    input.FINTWIN_STAGING_LOCAL === "1" &&
    ["postgres-staging", "localhost", "127.0.0.1"].includes(database.hostname);

  const publicUrl = (() => {
    try {
      return input.FINTWIN_PUBLIC_URL ? new URL(input.FINTWIN_PUBLIC_URL) : null;
    } catch {
      return null;
    }
  })();
  const productionLocalRequested =
    environment === "production" && input.FINTWIN_PRODUCTION_LOCAL === "1";
  const productionLocal =
    productionLocalRequested &&
    ["localhost", "127.0.0.1"].includes(database.hostname) &&
    publicUrl?.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(publicUrl.hostname);

  if (productionLocalRequested && !productionLocal) {
    throw new Error(
      "FINTWIN_PRODUCTION_LOCAL=1 só é permitido com aplicação e PostgreSQL em loopback.",
    );
  }

  if (environment === "staging" || environment === "production") {
    if (!productionLocal && !input.FINTWIN_PUBLIC_URL?.startsWith("https://")) {
      throw new Error(`${environment} exige FINTWIN_PUBLIC_URL com https://.`);
    }
    if (!productionLocal && input.FINTWIN_ENFORCE_TLS !== "1") {
      throw new Error(`${environment} exige FINTWIN_ENFORCE_TLS=1.`);
    }
    if (
      !stagingLocalDocker &&
      !productionLocal &&
      !["require", "verify-ca", "verify-full"].includes(database.sslmode ?? "")
    ) {
      throw new Error(`${environment} exige TLS na DATABASE_URL (sslmode=require ou superior).`);
    }
    if (!input.FINTWIN_DOCUMENT_ENCRYPTION_KEY || Buffer.from(input.FINTWIN_DOCUMENT_ENCRYPTION_KEY, "base64").length !== 32) {
      throw new Error(`${environment} exige FINTWIN_DOCUMENT_ENCRYPTION_KEY base64 com 32 bytes.`);
    }
    if (!input.FINTWIN_AUDIT_SIGNING_KEY || input.FINTWIN_AUDIT_SIGNING_KEY.length < 32) {
      throw new Error(`${environment} exige FINTWIN_AUDIT_SIGNING_KEY com pelo menos 32 caracteres.`);
    }
    for (const [name, value] of [
      ["FINTWIN_DOCUMENT_ENCRYPTION_KEY_ID", input.FINTWIN_DOCUMENT_ENCRYPTION_KEY_ID],
      ["FINTWIN_AUDIT_SIGNING_KEY_ID", input.FINTWIN_AUDIT_SIGNING_KEY_ID],
    ]) {
      if (!value?.startsWith(`${environment}-`)) {
        throw new Error(`${name} tem de começar por ${environment}- para impedir reutilização entre ambientes.`);
      }
    }
    if (input.FINTWIN_REQUIRE_ENCRYPTED_DOCUMENTS !== "1") {
      throw new Error(`${environment} exige FINTWIN_REQUIRE_ENCRYPTED_DOCUMENTS=1.`);
    }
    const vercelHosted = input.VERCEL === "1";
    if (input.FINTWIN_AUDIT_ARCHIVE_REQUIRED !== "1") {
      if (!vercelHosted) {
        throw new Error(`${environment} exige FINTWIN_AUDIT_ARCHIVE_REQUIRED=1.`);
      }
    }
  }

  const warnings = [];
  if (
    (environment === "staging" || environment === "production") &&
    !input.SMTP_HOST?.trim()
  ) {
    warnings.push(
      `${environment} sem SMTP_HOST: verificação de email, recuperação e alertas por email não serão enviados.`,
    );
  }

  return {
    environment,
    databaseName: database.name,
    databaseHost: database.hostname,
    seedAllowed: policy.maySeed,
    localDeployment: stagingLocalDocker || productionLocal,
    warnings,
  };
}

