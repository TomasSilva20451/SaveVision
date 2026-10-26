import { access } from "node:fs/promises";
import path from "node:path";
import { requireWorkspaceManager } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db";
import { appendAuditEvent } from "@/server/audit/audit-ledger";
import { classifyReadError, type DocumentProbeResult } from "@/server/services/document-integrity-errors";
import { getDocumentStorage, documentStorageMode } from "@/server/storage/document-storage";

export type { DocumentProbeResult } from "@/server/services/document-integrity-errors";

const LOCAL_ROOT =
  process.env.FINTWIN_DOCUMENT_STORAGE_DIR?.trim() || path.join(process.cwd(), "storage", "documents");

/** Verifica existência do blob sem descarregar conteúdo completo quando possível. */
export async function probeDocumentStorage(storageKey: string): Promise<DocumentProbeResult> {
  if (documentStorageMode() === "local") {
    if (!/^[a-f0-9]{48}$/.test(storageKey)) return "MISSING";
    const filePath = path.join(LOCAL_ROOT, storageKey);
    try {
      await access(filePath);
      return "OK";
    } catch {
      return "MISSING";
    }
  }

  try {
    await getDocumentStorage().read(storageKey);
    return "OK";
  } catch (error) {
    return classifyReadError(error);
  }
}

export type DocumentIntegrityRow = {
  id: string;
  workspaceId: string;
  originalName: string;
  storageKey: string;
  integrityStatus: string;
  probe: DocumentProbeResult;
};

export async function scanStoredDocuments(options: {
  workspaceId?: string;
  /** false = apenas relatório, sem UPDATE na BD */
  persist?: boolean;
} = {}): Promise<{
  scanned: number;
  missing: number;
  decryptFail: number;
  quarantined: number;
  rows: DocumentIntegrityRow[];
}> {
  const persist = options.persist !== false;

  const docs = await db.storedDocument.findMany({
    where: options.workspaceId ? { workspaceId: options.workspaceId } : undefined,
    select: {
      id: true,
      workspaceId: true,
      originalName: true,
      storageKey: true,
      integrityStatus: true,
    },
    orderBy: { createdAt: "desc" },
  });

  let missing = 0;
  let decryptFail = 0;
  let quarantined = 0;
  const rows: DocumentIntegrityRow[] = [];
  const now = new Date();

  for (const doc of docs) {
    const probe = await probeDocumentStorage(doc.storageKey);
    rows.push({ ...doc, probe });

    if (probe === "OK" && doc.integrityStatus === "UNAVAILABLE" && persist) {
      await db.storedDocument.update({
        where: { id: doc.id },
        data: {
          integrityStatus: "OK",
          integrityReason: null,
          integrityCheckedAt: now,
        },
      });
      continue;
    }

    if (probe !== "OK") {
      if (probe === "MISSING") missing++;
      if (probe === "DECRYPT_FAIL") decryptFail++;
      if (doc.integrityStatus !== "UNAVAILABLE") {
        if (persist) {
          await db.storedDocument.update({
            where: { id: doc.id },
            data: {
              integrityStatus: "UNAVAILABLE",
              integrityReason: probe,
              integrityCheckedAt: now,
            },
          });
        }
        quarantined++;
      }
    } else if (persist && doc.integrityStatus === "OK") {
      await db.storedDocument.update({
        where: { id: doc.id },
        data: { integrityCheckedAt: now },
      });
    }
  }

  return { scanned: docs.length, missing, decryptFail, quarantined, rows };
}

export async function countUnavailableDocuments(): Promise<number> {
  return db.storedDocument.count({ where: { integrityStatus: "UNAVAILABLE" } });
}

export async function listUnavailableDocumentsForWorkspace(userId: string, workspaceId: string) {
  const membership = await requireWorkspaceManager(userId, workspaceId);
  if (!membership) return null;

  return db.storedDocument.findMany({
    where: { workspaceId, integrityStatus: "UNAVAILABLE" },
    orderBy: { integrityCheckedAt: "desc" },
    select: {
      id: true,
      originalName: true,
      integrityReason: true,
      integrityCheckedAt: true,
      createdAt: true,
    },
  });
}

export async function runDocumentIntegrityScanForWorkspace(userId: string, workspaceId: string) {
  const membership = await requireWorkspaceManager(userId, workspaceId);
  if (!membership) return null;

  const report = await scanStoredDocuments({ workspaceId, persist: true });

  await appendAuditEvent({
    actorUserId: userId,
    workspaceId,
    action: "DOCUMENT_INTEGRITY_SCAN",
    resourceType: "Workspace",
    resourceId: workspaceId,
    outcome: "SUCCESS",
    source: "document-integrity",
    metadata: {
      scanned: report.scanned,
      missing: report.missing,
      decryptFail: report.decryptFail,
      quarantined: report.quarantined,
    },
  });

  return report;
}

export async function markDocumentUnavailable(
  userId: string,
  workspaceId: string,
  documentId: string,
  reason: string,
) {
  const membership = await requireWorkspaceManager(userId, workspaceId);
  if (!membership) return null;

  const doc = await db.storedDocument.findFirst({ where: { id: documentId, workspaceId } });
  if (!doc) return null;

  await db.storedDocument.update({
    where: { id: doc.id },
    data: {
      integrityStatus: "UNAVAILABLE",
      integrityReason: reason,
      integrityCheckedAt: new Date(),
    },
  });

  await appendAuditEvent({
    actorUserId: userId,
    workspaceId,
    action: "DOCUMENT_QUARANTINED",
    resourceType: "StoredDocument",
    resourceId: doc.id,
    outcome: "SUCCESS",
    source: "document-integrity",
    metadata: { reason },
  });

  return { ok: true as const };
}
