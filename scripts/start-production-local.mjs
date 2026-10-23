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
const envPath = path.resolve(".env.production.local");

for (const file of [".env.observability.local", ".env.production.local"]) {
  const full = path.resolve(file);
  if (fs.existsSync(full)) config({ path: full, override: false });
}
mapDeploymentSecretFiles(process.env);
installResolvedSecrets(process.env);
validateEnvironment(process.env);

const serverPath = path.join(distRoot, "server", "middleware-manifest.json");
const staticCssDir = path.join(distRoot, "static", "chunks");

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

if (!fs.existsSync(serverPath)) {
  console.warn(`Aviso: manifesto do servidor incompleto em ${distRoot}; a continuar mesmo assim.`);
}

const port = process.env.PORT ?? "3000";
const child = spawn("pnpm", ["exec", "next", "start", "-p", port], {
  cwd: root,
  env: { ...process.env, NEXT_DIST_DIR: distDir },
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 1));
