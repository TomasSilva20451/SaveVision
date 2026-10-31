import fs from "node:fs";

export const SECRET_NAMES = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "FINTWIN_DOCUMENT_ENCRYPTION_KEY",
  "FINTWIN_AUDIT_SIGNING_KEY",
  "FINTWIN_BACKUP_ENCRYPTION_SECRET",
];

/** Resolve segredos montados pelo orquestrador sem os persistir num ficheiro .env. */
export function resolveSecretFiles(env, readFile = fs.readFileSync) {
  const resolved = { ...env };
  for (const name of SECRET_NAMES) {
    const file = resolved[`${name}_FILE`]?.trim();
    if (!file) continue;
    if (resolved[name]?.trim()) {
      throw new Error(`${name} e ${name}_FILE não podem ser usados em simultâneo.`);
    }
    const value = String(readFile(file, "utf8")).trim();
    if (!value) throw new Error(`O segredo ${name} montado em ${file} está vazio.`);
    resolved[name] = value;
  }
  return resolved;
}

export function installResolvedSecrets(target = process.env) {
  const resolved = resolveSecretFiles(target);
  for (const name of SECRET_NAMES) {
    if (resolved[name]) target[name] = resolved[name];
  }
  return target;
}

export function mapDeploymentSecretFiles(target = process.env) {
  const env = (target.FINTWIN_ENV ?? "").trim();
  // CI/e2e/dev usam DATABASE_URL inline; ignorar caminhos de deploy montados.
  if (env !== "staging" && env !== "production") {
    return target;
  }
  const mappings = [
    ["DATABASE_URL_FILE", "FINTWIN_DATABASE_URL_SECRET_FILE"],
    ["AUTH_SECRET_FILE", "FINTWIN_AUTH_SECRET_FILE"],
    ["FINTWIN_DOCUMENT_ENCRYPTION_KEY_FILE", "FINTWIN_DOCUMENT_KEY_SECRET_FILE"],
    ["FINTWIN_AUDIT_SIGNING_KEY_FILE", "FINTWIN_AUDIT_KEY_SECRET_FILE"],
  ];
  for (const [targetName, sourceName] of mappings) {
    const source = target[sourceName]?.trim();
    if (!target[targetName]?.trim() && source) target[targetName] = source;
  }
  return target;
}

