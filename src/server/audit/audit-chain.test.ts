import { describe, expect, it } from "vitest";
import {
  AUDIT_GENESIS_HASH,
  auditSignatureMatches,
  canonicalAuditJson,
  hashAuditPayload,
  signAuditHash,
  type AuditCanonicalPayload,
} from "@/server/audit/audit-chain";

const payload: AuditCanonicalPayload = {
  id: "evt-1",
  occurredAt: "2026-10-23T12:00:00.000Z",
  actorUserId: "user-1",
  actorReference: "user-1",
  workspaceId: "workspace-1",
  action: "TRANSACTION_CREATED",
  resourceType: "Transaction",
  resourceId: "tx-1",
  outcome: "SUCCESS",
  source: "server-action",
  requestId: "req-1",
  ipHash: null,
  userAgentHash: null,
  metadata: { z: 2, a: 1 },
  previousHash: AUDIT_GENESIS_HASH,
  signingKeyId: "test-v1",
};

describe("audit chain", () => {
  it("produz JSON e hash determinísticos independentemente da ordem das chaves", () => {
    const reordered = { ...payload, metadata: { a: 1, z: 2 } };
    expect(canonicalAuditJson(payload)).toBe(canonicalAuditJson(reordered));
    expect(hashAuditPayload(payload)).toBe(hashAuditPayload(reordered));
  });

  it("assina o hash e deteta adulteração", () => {
    const hash = hashAuditPayload(payload);
    const signature = signAuditHash(hash, "test-audit-key-with-at-least-32-characters");
    expect(auditSignatureMatches(hash, signature, "test-audit-key-with-at-least-32-characters")).toBe(true);
    expect(auditSignatureMatches(`${hash}0`, signature, "test-audit-key-with-at-least-32-characters")).toBe(false);
  });
});
