#!/usr/bin/env tsx
/**
 * Verifica integridade DB ↔ storage. Por omissão dry-run (só reporta).
 * --apply persiste quarentena (equivalente a scanStoredDocuments).
 */
import { scanStoredDocuments } from "@/server/services/document-integrity";

const apply = process.argv.includes("--apply");
const workspaceId = process.argv.find((arg) => arg.startsWith("--workspace="))?.split("=")[1];

async function main() {
  const report = await scanStoredDocuments({
    workspaceId,
    persist: apply,
  });
  const payload = {
    apply,
    workspaceId: workspaceId ?? "all",
    scanned: report.scanned,
    missing: report.missing,
    decryptFail: report.decryptFail,
    quarantined: report.quarantined,
    unavailableSamples: report.rows
      .filter((row) => row.probe !== "OK")
      .slice(0, 20)
      .map((row) => ({ id: row.id, name: row.originalName, probe: row.probe })),
  };
  console.log(JSON.stringify(payload, null, 2));

  if (!apply && (report.missing > 0 || report.decryptFail > 0)) {
    console.error("Integridade comprometida. Reexecuta com --apply para quarentena automática.");
    process.exit(2);
  }
  if (apply && report.quarantined > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
