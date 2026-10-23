#!/usr/bin/env node
import { spawn } from "node:child_process";
import { installResolvedSecrets } from "./secret-files.mjs";
import { validateEnvironment } from "./environment-policy.mjs";

installResolvedSecrets(process.env);
validateEnvironment(process.env);

const child = spawn(process.execPath, ["server.js"], {
  env: process.env,
  stdio: "inherit",
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

