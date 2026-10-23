import assert from "node:assert/strict";
import test from "node:test";
import {
  assertBackupDrillAllowed,
  filesToPrune,
  isAllowedDrillDatabaseName,
  retentionDays,
  assertBackupSecurity,
} from "./backup-policy.mjs";

test("retentionDays usa omissão segura", () => {
  assert.equal(retentionDays({}), 30);
  assert.equal(retentionDays({ FINTWIN_BACKUP_RETENTION_DAYS: "7" }), 7);
  assert.equal(retentionDays({ FINTWIN_BACKUP_RETENTION_DAYS: "nope" }), 30);
});

test("nomes de drill temporários", () => {
  assert.equal(isAllowedDrillDatabaseName("fintwin_drill"), true);
  assert.equal(isAllowedDrillDatabaseName("fintwin_drill_ci"), true);
  assert.equal(isAllowedDrillDatabaseName("fintwin_live"), false);
});

test("drill permitido em e2e", () => {
  assert.doesNotThrow(() => assertBackupDrillAllowed({ FINTWIN_ENV: "e2e" }));
});

test("drill bloqueado em produção", () => {
  assert.throws(() => assertBackupDrillAllowed({ FINTWIN_ENV: "production" }), /bloqueado/);
});

test("filesToPrune remove dumps antigos pelo timestamp no nome", () => {
  const now = Date.parse("2026-10-01T12:00:00Z");
  const old = "fintwin-20260801-120000.dump";
  const recent = "fintwin-20260928-120000.dump";
  const pruned = filesToPrune([old, recent], now, 30);
  assert.deepEqual(pruned, [old]);
});

test("produção bloqueia backup em claro", () => {
  assert.throws(() => assertBackupSecurity({ FINTWIN_ENV: "production" }), /backup cifrado/);
});

test("produção aceita cifra, key id próprio e remoção do claro", () => {
  assert.doesNotThrow(() => assertBackupSecurity({
    FINTWIN_ENV: "production",
    FINTWIN_BACKUP_ENCRYPTION_SECRET: "backup-secret-with-at-least-32-characters",
    FINTWIN_BACKUP_ENCRYPTION_KEY_ID: "production-backup-v1",
    FINTWIN_BACKUP_DELETE_PLAINTEXT: "yes",
  }));
});
