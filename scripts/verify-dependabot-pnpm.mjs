#!/usr/bin/env node
/**
 * Reproduz a condição que quebra o Dependabot: install com minimumReleaseAge alto.
 * Escreve evidência em .cursor/debug-35ddd3.log (session debug).
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const logPath = path.join(process.cwd(), ".cursor/debug-35ddd3.log");
const sessionId = "35ddd3";

function agentLog(hypothesisId, message, data) {
  const line = JSON.stringify({
    sessionId,
    hypothesisId,
    location: "scripts/verify-dependabot-pnpm.mjs",
    message,
    data,
    timestamp: Date.now(),
    runId: process.env.DEBUG_RUN_ID ?? "pre-fix",
  });
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${line}\n`);
}

const strict = spawnSync(
  "pnpm",
  ["install", "--frozen-lockfile"],
  {
    env: {
      ...process.env,
      npm_config_minimum_release_age: "4320",
    },
    encoding: "utf8",
  },
);

agentLog("H1", "pnpm install with high minimumReleaseAge", {
  status: strict.status,
  stderrTail: (strict.stderr ?? strict.stdout ?? "").slice(-800),
});

const normal = spawnSync("pnpm", ["install", "--frozen-lockfile"], { encoding: "utf8" });
agentLog("H2", "pnpm install with repo .npmrc excludes", {
  status: normal.status,
  stderrTail: (normal.stderr ?? normal.stdout ?? "").slice(-400),
});

const dependabotUpdate = spawnSync(
  "pnpm",
  [
    "update",
    "@prisma/adapter-pg@7.10.1",
    "--lockfile-only",
    "--config.minimum-release-age=4320",
  ],
  { encoding: "utf8" },
);
agentLog("H3", "dependabot-like pnpm update with minimum-release-age=4320", {
  status: dependabotUpdate.status,
  stderrTail: `${dependabotUpdate.stderr ?? ""}${dependabotUpdate.stdout ?? ""}`.slice(-800),
});

console.log(
  JSON.stringify(
    {
      strictStatus: strict.status,
      normalStatus: normal.status,
      dependabotUpdateStatus: dependabotUpdate.status,
    },
    null,
    2,
  ),
);
process.exit(
  normal.status === 0 && dependabotUpdate.status === 0 ? 0 : 1,
);
