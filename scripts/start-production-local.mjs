#!/usr/bin/env node
/**
 * Arranca `next start` na porta 3000 com `.next-production` e valida assets estáticos.
 * Evita HTML de um build e CSS/JS de outro (página “sem estilos”).
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { config } from "dotenv";
import { installResolvedSecrets, mapDeploymentSecretFiles } from "./secret-files.mjs";
import { validateEnvironment } from "./environment-policy.mjs";

const root = process.cwd();
const distDir = process.env.NEXT_DIST_DIR ?? ".next-production";
const distRoot = path.join(root, distDir);
const standaloneRoot = path.join(distRoot, "standalone");
for (const file of [".env.observability.local", ".env.production.local"]) {
  const full = path.resolve(file);
  if (fs.existsSync(full)) config({ path: full, override: false });
}
process.env.FINTWIN_ENV = "production";
process.env.FINTWIN_PRODUCTION_LOCAL = "1";
process.env.FINTWIN_PUBLIC_URL = `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
process.env.FINTWIN_ENFORCE_TLS = "0";
process.env.FINTWIN_LOCAL_AI_ENABLED = "1";
mapDeploymentSecretFiles(process.env);
installResolvedSecrets(process.env);
validateEnvironment(process.env);

const manifestPath = path.join(distRoot, "server", "middleware-manifest.json");
const standaloneServerPath = path.join(standaloneRoot, "server.js");
const staticCssDir = path.join(distRoot, "static", "css");

if (!fs.existsSync(path.join(distRoot, "BUILD_ID"))) {
  console.error(`Build em falta (${distDir}). Executa: pnpm build:production`);
  process.exit(1);
}

const cssFiles = fs.existsSync(staticCssDir)
  ? fs.readdirSync(staticCssDir).filter((name) => name.endsWith(".css"))
  : [];
if (cssFiles.length === 0) {
  console.error(`Nenhum CSS em ${staticCssDir}. Executa: pnpm build:production`);
  process.exit(1);
}

if (!fs.existsSync(manifestPath)) {
  console.warn(`Aviso: manifesto do servidor incompleto em ${distRoot}; a continuar mesmo assim.`);
}
if (!fs.existsSync(standaloneServerPath)) {
  console.error(`Servidor standalone em falta (${standaloneServerPath}). Executa: pnpm build:production`);
  process.exit(1);
}

for (const [source, target] of [
  [path.join(distRoot, "static"), path.join(standaloneRoot, distDir, "static")],
  [path.join(root, "public"), path.join(standaloneRoot, "public")],
]) {
  if (!fs.existsSync(source)) continue;
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true });
}

const port = process.env.PORT ?? "3000";
const child = spawn(process.execPath, [standaloneServerPath], {
  cwd: standaloneRoot,
  env: {
    ...process.env,
    HOSTNAME: "127.0.0.1",
    NEXT_DIST_DIR: distDir,
    PORT: port,
  },
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 1));
