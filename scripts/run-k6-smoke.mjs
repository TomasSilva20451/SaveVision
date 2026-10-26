#!/usr/bin/env node
/**
 * Executa k6 smoke se disponível; caso contrário imprime instruções.
 */
import { spawnSync } from "node:child_process";

const base = process.env.BASE_URL ?? process.env.FINTWIN_PUBLIC_URL ?? "http://127.0.0.1:3000";
const env = { ...process.env, BASE_URL: base };

function hasK6() {
  return spawnSync("k6", ["version"], { encoding: "utf8" }).status === 0;
}

function runK6() {
  const r = spawnSync("k6", ["run", "tests/load/smoke.js"], { stdio: "inherit", env });
  process.exit(r.status ?? 1);
}

function runDockerK6() {
  const r = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "-e",
      `BASE_URL=${base}`,
      "-e",
      `FINTWIN_METRICS_TOKEN=${env.FINTWIN_METRICS_TOKEN ?? ""}`,
      "-v",
      `${process.cwd()}/tests/load:/scripts:ro`,
      "grafana/k6:0.54.0",
      "run",
      "/scripts/smoke.js",
    ],
    { stdio: "inherit" },
  );
  process.exit(r.status ?? 1);
}

if (hasK6()) runK6();
if (spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0) runDockerK6();

console.error("[load] Instala k6 ou Docker para correr smoke. Ver tests/load/README.md");
process.exit(1);
