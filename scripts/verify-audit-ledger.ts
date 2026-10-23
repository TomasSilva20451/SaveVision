#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import {
  AUDIT_GENESIS_HASH,
  auditSignatureMatches,
  hashAuditPayload,
  type AuditCanonicalPayload,
} from "@/server/audit/audit-chain";

const connectionString = process.env.DATABASE_URL;
const environment = process.env.FINTWIN_ENV ?? "development";
const key = process.env.FINTWIN_AUDIT_SIGNING_KEY
  ?? process.env.AUTH_SECRET
  ?? ((environment === "development" || environment === "e2e" || environment === "demo")
    ? "fintwin-non-production-audit-key-32-characters"
    : undefined);
const keyId = process.env.FINTWIN_AUDIT_SIGNING_KEY_ID ?? `${process.env.FINTWIN_ENV ?? "development"}-development-fallback`;
if (!connectionString || !key || key.length < 32) throw new Error("DATABASE_URL/chave de auditoria em falta.");
const signingKey = key;

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  try {
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
      if (event.previousHash !== previousHash || event.eventHash !== hashAuditPayload(payload)) {
        throw new Error(`Cadeia de auditoria inválida na sequência ${event.sequence}.`);
      }
      if (event.signingKeyId !== keyId || !auditSignatureMatches(event.eventHash, event.signature, signingKey)) {
        throw new Error(`Assinatura de auditoria inválida na sequência ${event.sequence}.`);
      }
      previousHash = event.eventHash;
    }
    const attempts = await db.auditTamperAttempt.count();
    if (attempts > 0) throw new Error(`${attempts} tentativa(s) de adulteração registada(s).`);
    console.log(JSON.stringify({ ok: true, events: events.length, lastHash: previousHash }));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

