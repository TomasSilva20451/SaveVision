#!/usr/bin/env node
/**
 * Cria .env.backup.local com secret cifrado e valida rclone (se configurado).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const examplePath = path.join(root, ".env.backup.example");
const localPath = path.join(root, ".env.backup.local");

if (!fs.existsSync(examplePath)) {
  console.error(".env.backup.example em falta.");
  process.exit(1);
}

function generateSecret() {
  return crypto.randomBytes(32).toString("base64url");
}

function upsertLocalEnv() {
  const example = fs.readFileSync(examplePath, "utf8");
  const secretDir = path.join(root, "storage", "secrets");
  const secretPath = path.join(secretDir, "backup-encryption-key");
  fs.mkdirSync(secretDir, { recursive: true, mode: 0o700 });
  if (!fs.existsSync(secretPath)) {
    fs.writeFileSync(secretPath, `${generateSecret()}\n`, { mode: 0o600 });
    console.log(`[setup] Chave criada em ${secretPath} (0600; fora de .env).`);
  }
  if (fs.existsSync(localPath)) {
    const current = fs.readFileSync(localPath, "utf8");
    if (/FINTWIN_BACKUP_ENCRYPTION_SECRET_FILE=.+/.test(current)) {
      console.log(`[setup] ${localPath} já referencia a chave — mantido.`);
      return;
    }
    const updated = `${current.trimEnd()}\nFINTWIN_BACKUP_ENCRYPTION_SECRET_FILE=storage/secrets/backup-encryption-key\nFINTWIN_BACKUP_ENCRYPTION_KEY_ID=development-backup-v1\n`;
    fs.writeFileSync(localPath, updated.endsWith("\n") ? updated : `${updated}\n`, { mode: 0o600 });
    console.log(`[setup] Referência à chave adicionada a ${localPath}`);
    return;
  }
  fs.writeFileSync(localPath, example, { mode: 0o600 });
  console.log(`[setup] Criado ${localPath} (chmod 600)`);
}

function rcloneConfigPath() {
  return path.join(root, ".rclone.conf");
}

function rcloneEnv() {
  return { ...process.env, RCLONE_CONFIG: rcloneConfigPath() };
}

function ensureDevOffsiteRemote() {
  const which = spawnSync("command", ["-v", "rclone"], { shell: true, encoding: "utf8" });
  if (which.status !== 0) {
    console.warn("[setup] --dev-offsite ignorado: rclone não instalado (brew install rclone).");
    return false;
  }
  const offsiteRoot = path.join(os.homedir(), "FinTwin-backups-offsite");
  fs.mkdirSync(offsiteRoot, { recursive: true });
  const configPath = rcloneConfigPath();
  const remote = "fintwin-offsite";
  if (!fs.existsSync(configPath)) {
    const create = spawnSync(
      "rclone",
      ["config", "create", remote, "local", "--non-interactive"],
      { env: rcloneEnv(), encoding: "utf8" },
    );
    if (create.status !== 0) {
      console.warn("[setup] Falha ao criar remoto local rclone:", create.stderr);
      return false;
    }
    spawnSync("rclone", ["config", "update", remote, "--local-no-check-updated"], { env: rcloneEnv() });
  }
  spawnSync("rclone", ["config", "update", remote, "--local-root", offsiteRoot], { env: rcloneEnv() });
  const list = spawnSync("rclone", ["listremotes"], { env: rcloneEnv(), encoding: "utf8" });
  if (list.stdout.includes(`${remote}:`)) {
    console.log(`[setup] Off-site dev: rclone ${remote} → copias em ${offsiteRoot}/fintwin/backups/`);
    return true;
  }
  return false;
}

function checkRclone() {
  const env = fs.readFileSync(localPath, "utf8");
  const remoteMatch = env.match(/^FINTWIN_RCLONE_REMOTE=(.+)$/m);
  const remote = remoteMatch?.[1]?.trim();
  if (!remote) return;
  const which = spawnSync("command", ["-v", "rclone"], { shell: true, encoding: "utf8" });
  if (which.status !== 0) {
    console.warn("[setup] Aviso: instala rclone (brew install rclone) antes do primeiro backup off-site.");
    return;
  }
  const list = spawnSync("rclone", ["listremotes"], { env: rcloneEnv(), encoding: "utf8" });
  if (list.status !== 0) {
    console.warn("[setup] Aviso: rclone listremotes falhou.");
    return;
  }
  const needle = `${remote}:`;
  if (!list.stdout.includes(needle)) {
    console.warn(
      `[setup] Remoto «${remote}» ainda não existe. Corre: pnpm backup:setup -- --dev-offsite\n` +
        `  Produção: rclone config (S3/B2/etc.) com RCLONE_CONFIG=$PWD/.rclone.conf ou remoto global.`,
    );
    return;
  }
  console.log(`[setup] rclone remoto OK: ${remote}`);
}

upsertLocalEnv();
if (process.argv.includes("--dev-offsite")) {
  ensureDevOffsiteRemote();
}
checkRclone();
console.log("[setup] Próximo: pnpm backup:install-cron  (ou pnpm db:backup:run para testar agora)");
