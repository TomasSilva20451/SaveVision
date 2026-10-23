#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const distDir = process.env.NEXT_DIST_DIR ?? ".next";
const standaloneRoot = path.join(root, distDir, "standalone");
const serverPath = path.join(standaloneRoot, "server.js");

process.env.FINTWIN_DOCUMENT_STORAGE_DIR ??= path.join(root, "storage", "documents");
process.env.FINTWIN_AUDIT_ARCHIVE_DIR ??= path.join(root, "storage", "audit");

if (!fs.existsSync(serverPath)) {
  throw new Error("Artefacto standalone em falta. Executa `pnpm build` primeiro.");
}

function replaceBuildDirectory(source, destination) {
  fs.rmSync(destination, { recursive: true, force: true });
  if (fs.existsSync(source)) {
    fs.cpSync(source, destination, { recursive: true });
  }
}

replaceBuildDirectory(path.join(root, "public"), path.join(standaloneRoot, "public"));
replaceBuildDirectory(
  path.join(root, distDir, "static"),
  path.join(standaloneRoot, ".next", "static"),
);

process.chdir(standaloneRoot);
await import(pathToFileURL(serverPath).href);
