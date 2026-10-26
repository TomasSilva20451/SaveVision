import { requireWorkspaceAccess, requireWorkspaceEditor } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db";
import {
  ALLOWED_DOCUMENT_MIME,
  MAX_DOCUMENT_BYTES,
  sha256Hex,
} from "@/server/storage/local-files";
import { getDocumentStorage } from "@/server/storage/document-storage";
import {
  mimeMatchesSniff,
  sanitizeOriginalFilename,
  sniffMimeFromBytes,
} from "@/server/storage/file-sniff";
import { scanUploadedDocumentBytes } from "@/server/storage/document-malware-scan";
import { appendAuditEvent } from "@/server/audit/audit-ledger";
import { probeDocumentStorage } from "@/server/services/document-integrity";

export async function listDocuments(userId: string, workspaceId: string) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  return db.storedDocument.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      integrityStatus: true,
    },
  });
}

export async function uploadDocument(
  userId: string,
  workspaceId: string,
  file: { name: string; mimeType: string; bytes: Uint8Array },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  if (file.bytes.byteLength > MAX_DOCUMENT_BYTES) {
    return { error: "Ficheiro demasiado grande (máx. 5 MB)." as const };
  }

  const sniffed = sniffMimeFromBytes(file.bytes);
  if (!sniffed || !ALLOWED_DOCUMENT_MIME.has(sniffed)) {
    return { error: "Tipo de ficheiro não permitido." as const };
  }
  if (!mimeMatchesSniff(file.mimeType, sniffed)) {
    return { error: "O conteúdo não corresponde ao tipo declarado." as const };
  }

  const scan = await scanUploadedDocumentBytes(file.bytes, sniffed);
  if (!scan.ok) {
    return { error: scan.reason as string };
  }

  const { storageKey } = await getDocumentStorage().save({
    workspaceId,
    bytes: file.bytes,
    mimeType: file.mimeType,
  });

  const record = await db.storedDocument.create({
    data: {
      workspaceId,
      userId,
      originalName: sanitizeOriginalFilename(file.name),
      mimeType: sniffed,
      sizeBytes: file.bytes.byteLength,
      storageKey,
      sha256: sha256Hex(file.bytes),
    },
  });

  await appendAuditEvent({
    actorUserId: userId,
    workspaceId,
    action: "DOCUMENT_UPLOADED",
    resourceType: "StoredDocument",
    resourceId: record.id,
    outcome: "SUCCESS",
    source: "document-service",
    metadata: { mimeType: record.mimeType, sizeBytes: record.sizeBytes, sha256: record.sha256 },
  });

  return { document: record };
}

export type ReadDocumentResult =
  | { doc: Awaited<ReturnType<typeof db.storedDocument.findFirst>> & object; bytes: Uint8Array }
  | { unavailable: true; doc: NonNullable<Awaited<ReturnType<typeof db.storedDocument.findFirst>>> };

export async function readDocumentBytes(
  userId: string,
  workspaceId: string,
  documentId: string,
): Promise<ReadDocumentResult | null> {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const doc = await db.storedDocument.findFirst({
    where: { id: documentId, workspaceId },
  });
  if (!doc) return null;

  if (doc.integrityStatus === "UNAVAILABLE") {
    return { unavailable: true as const, doc };
  }

  let bytes: Uint8Array;
  try {
    bytes = await getDocumentStorage().read(doc.storageKey);
  } catch {
    const probe = await probeDocumentStorage(doc.storageKey);
    await db.storedDocument.update({
      where: { id: doc.id },
      data: {
        integrityStatus: "UNAVAILABLE",
        integrityReason: probe,
        integrityCheckedAt: new Date(),
      },
    });
    await appendAuditEvent({
      actorUserId: userId,
      workspaceId,
      action: "DOCUMENT_READ_FAILED",
      resourceType: "StoredDocument",
      resourceId: doc.id,
      outcome: "FAILURE",
      source: "document-service",
      metadata: { probe },
    });
    return { unavailable: true as const, doc };
  }

  await appendAuditEvent({
    actorUserId: userId,
    workspaceId,
    action: "DOCUMENT_DOWNLOADED",
    resourceType: "StoredDocument",
    resourceId: doc.id,
    outcome: "SUCCESS",
    source: "document-service",
    metadata: { sha256: doc.sha256 },
  });
  return { doc, bytes };
}
