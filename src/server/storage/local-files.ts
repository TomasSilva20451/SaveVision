import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageProvider } from "@/server/providers/contracts";
import {
  decryptEnvelope,
  encryptEnvelope,
  encryptionKeyFromEnvironment,
  isEncryptedEnvelope,
} from "@/server/security/envelope-encryption";

const ROOT = process.env.FINTWIN_DOCUMENT_STORAGE_DIR?.trim()
  || path.join(process.cwd(), "storage", "documents");

async function ensureRoot() {
  await mkdir(ROOT, { recursive: true });
}

export const localDocumentStorage: StorageProvider = {
  async save(input) {
    await ensureRoot();
    const storageKey = randomBytes(24).toString("hex");
    const filePath = path.join(ROOT, storageKey);
    const encrypted = encryptEnvelope(input.bytes, encryptionKeyFromEnvironment());
    await writeFile(filePath, encrypted, { mode: 0o600 });
    return { storageKey };
  },
  async read(storageKey) {
    if (!/^[a-f0-9]{48}$/.test(storageKey)) {
      throw new Error("Chave de armazenamento inválida.");
    }
    const filePath = path.join(ROOT, storageKey);
    const buffer = await readFile(filePath);
    if (!isEncryptedEnvelope(buffer)) {
      if (process.env.FINTWIN_REQUIRE_ENCRYPTED_DOCUMENTS === "1") {
        throw new Error("DOCUMENT_NOT_ENCRYPTED");
      }
      return new Uint8Array(buffer);
    }
    return decryptEnvelope(buffer, [encryptionKeyFromEnvironment()]);
  },
  async delete(storageKey) {
    if (!/^[a-f0-9]{48}$/.test(storageKey)) return;
    const filePath = path.join(ROOT, storageKey);
    await unlink(filePath).catch(() => undefined);
  },
};

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export const ALLOWED_DOCUMENT_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/csv",
  "text/plain",
]);

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
