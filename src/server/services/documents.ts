import { requireWorkspaceAccess, requireWorkspaceEditor } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db";
import {
  ALLOWED_DOCUMENT_MIME,
  localDocumentStorage,
  MAX_DOCUMENT_BYTES,
  sha256Hex,
} from "@/server/storage/local-files";
import {
  mimeMatchesSniff,
  sanitizeOriginalFilename,
  sniffMimeFromBytes,
} from "@/server/storage/file-sniff";
import { scanUploadedDocumentBytes } from "@/server/storage/document-malware-scan";
import { appendAuditEvent } from "@/server/audit/audit-ledger";

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

  const { storageKey } = await localDocumentStorage.save({
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

export async function readDocumentBytes(
  userId: string,
  workspaceId: string,
  documentId: string,
) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const doc = await db.storedDocument.findFirst({
    where: { id: documentId, workspaceId },
  });
  if (!doc) return null;

  const bytes = await localDocumentStorage.read(doc.storageKey);
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
