import { randomBytes } from "node:crypto";

const STORAGE_KEY = /^[a-f0-9]{48}$/;

export function newStorageKey(): string {
  return randomBytes(24).toString("hex");
}

export function assertStorageKey(storageKey: string) {
  if (!STORAGE_KEY.test(storageKey)) throw new Error("Chave de armazenamento inválida.");
}

/** Bucket privado por ambiente. Impede partilha acidental staging/produção. */
export function assertPrivateBucket(bucket: string, environment: string) {
  const normalized = bucket.trim();
  if (!/^fintwin-[a-z0-9-]+$/.test(normalized)) {
    throw new Error("O bucket tem de começar por fintwin- e usar só minúsculas.");
  }
  if ((environment === "staging" || environment === "production") && !normalized.startsWith(`fintwin-${environment}-`)) {
    throw new Error(`O bucket de ${environment} tem de começar por fintwin-${environment}-.`);
  }
  return normalized;
}

export function objectKey(environment: string, workspaceId: string, storageKey: string): string {
  assertStorageKey(storageKey);
  if (!/^[a-z0-9-]+$/.test(environment)) throw new Error("Ambiente inválido.");
  if (!/^[A-Za-z0-9_-]+$/.test(workspaceId)) throw new Error("Workspace inválido.");
  return `${environment}/${workspaceId}/${storageKey}`;
}
