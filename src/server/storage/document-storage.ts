import type { StorageProvider } from "@/server/providers/contracts";
import { assertPrivateBucket, assertStorageKey, newStorageKey, objectKey } from "@/lib/platform/object-storage";
import {
  decryptEnvelope,
  encryptEnvelope,
  encryptionKeyFromEnvironment,
  isEncryptedEnvelope,
} from "@/server/security/envelope-encryption";
import { localDocumentStorage } from "@/server/storage/local-files";
import { signS3Request } from "@/server/storage/s3-sigv4";

export function documentStorageMode(): "local" | "s3" {
  const mode = process.env.FINTWIN_OBJECT_STORAGE?.trim() || "local";
  if (mode !== "local" && mode !== "s3") throw new Error("FINTWIN_OBJECT_STORAGE tem de ser local ou s3.");
  return mode;
}

function s3Config() {
  const environment = process.env.FINTWIN_ENV?.trim() || "development";
  const bucket = assertPrivateBucket(process.env.FINTWIN_OBJECT_BUCKET ?? "", environment);
  const endpoint = process.env.FINTWIN_OBJECT_ENDPOINT?.trim();
  const region = process.env.FINTWIN_OBJECT_REGION?.trim() || "eu-west-1";
  const accessKeyId = process.env.FINTWIN_OBJECT_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.FINTWIN_OBJECT_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("Armazenamento s3 exige endpoint, access key e secret.");
  }
  return { environment, bucket, endpoint: endpoint.replace(/\/$/, ""), region, accessKeyId, secretAccessKey };
}

async function s3Call(method: "GET" | "PUT" | "DELETE", key: string, body?: Uint8Array) {
  const config = s3Config();
  const url = new URL(`${config.endpoint}/${config.bucket}/${key}`);
  const headers = signS3Request({
    method,
    url,
    body,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: config.region,
  });
  const response = await fetch(url, { method, headers, body: body ? Buffer.from(body) : undefined });
  if (!response.ok) throw new Error(`OBJECT_STORAGE_${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

export const privateObjectStorage: StorageProvider = {
  async save(input) {
    const config = s3Config();
    const storageKey = newStorageKey();
    const key = objectKey(config.environment, input.workspaceId, storageKey);
    const encrypted = encryptEnvelope(input.bytes, encryptionKeyFromEnvironment());
    await s3Call("PUT", key, encrypted);
    return { storageKey: key };
  },
  async read(storageKey) {
    if (storageKey.includes("..") || storageKey.startsWith("/")) throw new Error("Chave de armazenamento inválida.");
    const bytes = await s3Call("GET", storageKey);
    if (!isEncryptedEnvelope(bytes)) {
      if (process.env.FINTWIN_REQUIRE_ENCRYPTED_DOCUMENTS === "1") throw new Error("DOCUMENT_NOT_ENCRYPTED");
      return bytes;
    }
    return decryptEnvelope(bytes, [encryptionKeyFromEnvironment()]);
  },
  async delete(storageKey) {
    if (!storageKey.includes("/")) {
      assertStorageKey(storageKey);
    }
    await s3Call("DELETE", storageKey);
  },
};

export function getDocumentStorage(): StorageProvider {
  return documentStorageMode() === "s3" ? privateObjectStorage : localDocumentStorage;
}
