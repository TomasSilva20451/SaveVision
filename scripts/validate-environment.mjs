#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { validateEnvironment } from "./environment-policy.mjs";
import { installResolvedSecrets, mapDeploymentSecretFiles } from "./secret-files.mjs";

const fileIndex = process.argv.indexOf("--file");
if (fileIndex >= 0) {
  const rawPath = process.argv[fileIndex + 1];
  if (!rawPath) throw new Error("--file exige um caminho.");
  const envPath = path.resolve(rawPath);
  if (!fs.existsSync(envPath)) throw new Error(`Ficheiro inexistente: ${envPath}`);
  const loaded = config({ path: envPath, override: false });
  if (loaded.error) throw loaded.error;
}

mapDeploymentSecretFiles(process.env);
installResolvedSecrets(process.env);

const result = validateEnvironment(process.env);
console.log(
  `[env] ${result.environment}: ${result.databaseName}@${result.databaseHost}; ` +
    `seed=${result.seedAllowed ? "permitido apenas por perfil" : "bloqueado"}`,
);
for (const warning of result.warnings ?? []) {
  console.warn(`[env] aviso: ${warning}`);
}

