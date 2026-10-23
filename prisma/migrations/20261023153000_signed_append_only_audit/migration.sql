CREATE TABLE "AuditEvent" (
    "sequence" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "actorReference" TEXT NOT NULL,
    "workspaceId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "requestId" TEXT,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "metadata" JSONB,
    "previousHash" TEXT NOT NULL,
    "eventHash" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "signingKeyId" TEXT NOT NULL,
    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("sequence")
);

CREATE TABLE "AuditTamperAttempt" (
    "id" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operation" TEXT NOT NULL,
    "targetId" TEXT,
    "databaseUser" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    CONSTRAINT "AuditTamperAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuditEvent_id_key" ON "AuditEvent"("id");
CREATE UNIQUE INDEX "AuditEvent_eventHash_key" ON "AuditEvent"("eventHash");
CREATE INDEX "AuditEvent_workspaceId_occurredAt_idx" ON "AuditEvent"("workspaceId", "occurredAt");
CREATE INDEX "AuditEvent_actorUserId_occurredAt_idx" ON "AuditEvent"("actorUserId", "occurredAt");
CREATE INDEX "AuditEvent_action_occurredAt_idx" ON "AuditEvent"("action", "occurredAt");
CREATE INDEX "AuditTamperAttempt_detectedAt_idx" ON "AuditTamperAttempt"("detectedAt");

CREATE OR REPLACE FUNCTION fintwin_block_audit_event_mutation()
RETURNS trigger AS $$
BEGIN
  INSERT INTO "AuditTamperAttempt" (
    "id", "operation", "targetId", "databaseUser", "source"
  ) VALUES (
    'tamper_' || md5(random()::text || clock_timestamp()::text),
    TG_OP,
    OLD."id",
    current_user,
    'postgres-trigger'
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditEvent_append_only"
BEFORE UPDATE OR DELETE ON "AuditEvent"
FOR EACH ROW EXECUTE FUNCTION fintwin_block_audit_event_mutation();

CREATE OR REPLACE FUNCTION fintwin_block_tamper_attempt_mutation()
RETURNS trigger AS $$
BEGIN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditTamperAttempt_append_only"
BEFORE UPDATE OR DELETE ON "AuditTamperAttempt"
FOR EACH ROW EXECUTE FUNCTION fintwin_block_tamper_attempt_mutation();

REVOKE UPDATE, DELETE, TRUNCATE ON "AuditEvent" FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON "AuditTamperAttempt" FROM PUBLIC;
