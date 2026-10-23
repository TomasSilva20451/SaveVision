import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const AUDIT_GENESIS_HASH = "0".repeat(64);

export type AuditCanonicalPayload = {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  actorReference: string;
  workspaceId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  outcome: string;
  source: string;
  requestId: string | null;
  ipHash: string | null;
  userAgentHash: string | null;
  metadata: unknown;
  previousHash: string;
  signingKeyId: string;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

export function canonicalAuditJson(payload: AuditCanonicalPayload): string {
  return JSON.stringify(stableValue(payload));
}

export function hashAuditPayload(payload: AuditCanonicalPayload): string {
  return createHash("sha256").update(canonicalAuditJson(payload)).digest("hex");
}

export function signAuditHash(eventHash: string, key: string): string {
  return createHmac("sha256", key).update(eventHash).digest("base64url");
}

export function auditSignatureMatches(eventHash: string, signature: string, key: string): boolean {
  const expected = Buffer.from(signAuditHash(eventHash, key));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

