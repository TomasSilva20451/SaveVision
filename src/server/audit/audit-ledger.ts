import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  AUDIT_GENESIS_HASH,
  auditSignatureMatches,
  canonicalAuditJson,
  hashAuditPayload,
  signAuditHash,
  type AuditCanonicalPayload,
} from "@/server/audit/audit-chain";

const AUDIT_LOCK_KEY = 8_274_916_531;

export type AuditOutcome = "SUCCESS" | "DENIED" | "FAILURE";

export type AuditEventInput = {
  actorUserId?: string | null;
  actorReference?: string;
  workspaceId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  outcome: AuditOutcome;
  source: string;
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function auditSigningConfig() {
  const environment = process.env.FINTWIN_ENV ?? "development";
  const key = process.env.FINTWIN_AUDIT_SIGNING_KEY
    ?? process.env.AUTH_SECRET
    ?? ((environment === "development" || environment === "e2e" || environment === "demo")
      ? "fintwin-non-production-audit-key-32-characters"
      : undefined);
  const keyId = process.env.FINTWIN_AUDIT_SIGNING_KEY_ID ?? `${environment}-development-fallback`;
  if (!key || key.length < 32) throw new Error("AUDIT_SIGNING_KEY_MISSING");
  return { key, keyId };
}

function archivePath() {
  const configured = process.env.FINTWIN_AUDIT_ARCHIVE_DIR?.trim();
  const environment = process.env.FINTWIN_ENV?.trim() || "development";
  return path.join(
    configured || path.join(process.cwd(), "storage", "audit"),
    environment,
    "audit-events.jsonl",
  );
}

async function appendIndependentArchive(event: Record<string, unknown>) {
  const filePath = archivePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(event)}\n`, { encoding: "utf8", mode: 0o600 });
}

function canonicalPayload(input: AuditEventInput, id: string, occurredAt: Date, previousHash: string, keyId: string): AuditCanonicalPayload {
  return {
    id,
    occurredAt: occurredAt.toISOString(),
    actorUserId: input.actorUserId ?? null,
    actorReference: input.actorReference ?? input.actorUserId ?? "anonymous",
    workspaceId: input.workspaceId ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    outcome: input.outcome,
    source: input.source,
    requestId: input.requestId ?? null,
    ipHash: input.ip ? sha256(`ip:${input.ip}`) : null,
    userAgentHash: input.userAgent ? sha256(`ua:${input.userAgent}`) : null,
    metadata: input.metadata ?? null,
    previousHash,
    signingKeyId: keyId,
  };
}

/**
 * Acrescenta um evento ao ledger global. O advisory lock serializa o cálculo do
 * previousHash; a base bloqueia UPDATE/DELETE e o arquivo JSONL vive fora da BD.
 */
export async function appendAuditEvent(input: AuditEventInput) {
  const { key, keyId } = auditSigningConfig();
  const id = randomUUID();
  const occurredAt = new Date();

  const event = await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${AUDIT_LOCK_KEY})`);
    const previous = await tx.auditEvent.findFirst({
      orderBy: { sequence: "desc" },
      select: { eventHash: true },
    });
    const payload = canonicalPayload(input, id, occurredAt, previous?.eventHash ?? AUDIT_GENESIS_HASH, keyId);
    const eventHash = hashAuditPayload(payload);
    const signature = signAuditHash(eventHash, key);
    return tx.auditEvent.create({
      data: {
        ...payload,
        occurredAt,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        eventHash,
        signature,
      },
    });
  // O advisory lock é a autoridade de serialização da cadeia. Em READ COMMITTED,
  // a leitura seguinte ao lock vê sempre o último hash já confirmado; SERIALIZABLE
  // conserva um snapshot anterior ao lock e pode gerar P2034 sob downloads paralelos.
  }, { isolationLevel: "ReadCommitted" });

  try {
    await appendIndependentArchive({
      ...event,
      sequence: event.sequence.toString(),
      occurredAt: event.occurredAt.toISOString(),
    });
  } catch (error) {
    if (process.env.FINTWIN_AUDIT_ARCHIVE_REQUIRED === "1") throw error;
    console.error("[audit] arquivo independente indisponível", error);
  }
  return event;
}

export async function verifyAuditLedger() {
  const { key, keyId } = auditSigningConfig();
  const events = await db.auditEvent.findMany({ orderBy: { sequence: "asc" } });
  let previousHash = AUDIT_GENESIS_HASH;
  for (const event of events) {
    const payload: AuditCanonicalPayload = {
      id: event.id,
      occurredAt: event.occurredAt.toISOString(),
      actorUserId: event.actorUserId,
      actorReference: event.actorReference,
      workspaceId: event.workspaceId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      outcome: event.outcome,
      source: event.source,
      requestId: event.requestId,
      ipHash: event.ipHash,
      userAgentHash: event.userAgentHash,
      metadata: event.metadata ?? null,
      previousHash: event.previousHash,
      signingKeyId: event.signingKeyId,
    };
    if (event.previousHash !== previousHash) return { ok: false as const, sequence: event.sequence, reason: "CHAIN_BREAK" as const };
    if (event.signingKeyId !== keyId) return { ok: false as const, sequence: event.sequence, reason: "UNKNOWN_KEY" as const };
    const recalculated = hashAuditPayload(payload);
    if (recalculated !== event.eventHash) return { ok: false as const, sequence: event.sequence, reason: "HASH_MISMATCH" as const };
    if (!auditSignatureMatches(event.eventHash, event.signature, key)) return { ok: false as const, sequence: event.sequence, reason: "SIGNATURE_MISMATCH" as const };
    previousHash = event.eventHash;
  }
  const attempts = await db.auditTamperAttempt.count();
  return { ok: true as const, count: events.length, tamperAttempts: attempts, lastHash: previousHash };
}

export { canonicalAuditJson };
