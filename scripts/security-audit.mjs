#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const level = process.env.FINTWIN_AUDIT_LEVEL ?? "high";
const scope = process.env.FINTWIN_AUDIT_SCOPE ?? "prod";
const args = ["audit", "--audit-level", level];
if (scope === "prod") args.push("--prod");

const result = spawnSync("pnpm", args, {
  encoding: "utf8",
  stdio: "inherit",
});

if (result.status !== 0) {
  console.error(`pnpm audit falhou (nível ${level}). Corrigir ou documentar excepção.`);
  process.exit(result.status ?? 1);
}

console.log("[security-audit] OK");
