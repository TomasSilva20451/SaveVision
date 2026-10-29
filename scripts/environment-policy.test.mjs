import assert from "node:assert/strict";
import test from "node:test";
import { databaseNameFromUrl, validateEnvironment } from "./environment-policy.mjs";

const secret = "test-only-auth-secret-with-32-characters";

test("extrai o nome da base sem expor credenciais", () => {
  assert.deepEqual(
    databaseNameFromUrl("postgresql://user:pass@localhost:5433/fintwin_e2e?schema=public"),
    { name: "fintwin_e2e", hostname: "localhost", sslmode: null },
  );
});

test("produção exige HTTPS, TLS PostgreSQL e chaves próprias do ambiente", () => {
  const key = Buffer.alloc(32, 3).toString("base64");
  assert.doesNotThrow(() => validateEnvironment({
    FINTWIN_ENV: "production",
    DATABASE_URL: "postgresql://u:p@db/fintwin_live?sslmode=verify-full",
    AUTH_SECRET: secret,
    FINTWIN_PUBLIC_URL: "https://fintwin.example",
    FINTWIN_ENFORCE_TLS: "1",
    FINTWIN_DOCUMENT_ENCRYPTION_KEY: key,
    FINTWIN_DOCUMENT_ENCRYPTION_KEY_ID: "production-documents-v1",
    FINTWIN_AUDIT_SIGNING_KEY: "production-audit-signing-key-with-32-characters",
    FINTWIN_AUDIT_SIGNING_KEY_ID: "production-audit-v1",
    FINTWIN_REQUIRE_ENCRYPTED_DOCUMENTS: "1",
    FINTWIN_AUDIT_ARCHIVE_REQUIRED: "1",
  }));
});

test("produção recusa ligação PostgreSQL sem TLS", () => {
  const key = Buffer.alloc(32, 3).toString("base64");
  assert.throws(() => validateEnvironment({
    FINTWIN_ENV: "production",
    DATABASE_URL: "postgresql://u:p@db/fintwin_live",
    AUTH_SECRET: secret,
    FINTWIN_PUBLIC_URL: "https://fintwin.example",
    FINTWIN_ENFORCE_TLS: "1",
    FINTWIN_DOCUMENT_ENCRYPTION_KEY: key,
    FINTWIN_DOCUMENT_ENCRYPTION_KEY_ID: "production-documents-v1",
    FINTWIN_AUDIT_SIGNING_KEY: "production-audit-signing-key-with-32-characters",
    FINTWIN_AUDIT_SIGNING_KEY_ID: "production-audit-v1",
    FINTWIN_REQUIRE_ENCRYPTED_DOCUMENTS: "1",
    FINTWIN_AUDIT_ARCHIVE_REQUIRED: "1",
  }), /exige TLS na DATABASE_URL/);
});

test("aceita uma base E2E local dedicada", () => {
  assert.equal(
    validateEnvironment({
      FINTWIN_ENV: "e2e",
      DATABASE_URL: "postgresql://u:p@localhost:5433/fintwin_e2e",
      FINTWIN_PRIMARY_DATABASE_URL: "postgresql://u:p@localhost:5433/fintwin",
      FINTWIN_ALLOW_E2E_CLEANUP: "yes",
      FINTWIN_SEED_PROFILE: "e2e",
      AUTH_SECRET: secret,
    }).databaseName,
    "fintwin_e2e",
  );
});

test("bloqueia E2E com fintwin_staging", () => {
  assert.throws(
    () =>
      validateEnvironment({
        FINTWIN_ENV: "e2e",
        DATABASE_URL: "postgresql://u:p@localhost:5433/fintwin_staging",
        FINTWIN_ALLOW_E2E_CLEANUP: "yes",
        AUTH_SECRET: secret,
      }),
    /reservada ao ambiente staging|não pertence ao ambiente e2e/,
  );
});

test("bloqueia E2E sobre a base principal", () => {
  assert.throws(
    () =>
      validateEnvironment({
        FINTWIN_ENV: "e2e",
        FINTWIN_EXPECTED_DATABASE: "fintwin",
        DATABASE_URL: "postgresql://u:p@localhost:5433/fintwin",
        FINTWIN_PRIMARY_DATABASE_URL: "postgresql://u:p@localhost:5433/fintwin",
        FINTWIN_ALLOW_E2E_CLEANUP: "yes",
        AUTH_SECRET: secret,
      }),
    /reservada ao ambiente development|coincide com a base principal/,
  );
});

test("bloqueia seeds em staging e produção", () => {
  assert.throws(
    () =>
      validateEnvironment({
        FINTWIN_ENV: "production",
        DATABASE_URL: "postgresql://u:p@db/fintwin_live",
        FINTWIN_SEED_PROFILE: "demo",
        AUTH_SECRET: secret,
      }),
    /não permite FINTWIN_SEED_PROFILE/,
  );
});

test("bloqueia troca acidental entre staging e produção", () => {
  assert.throws(
    () =>
      validateEnvironment({
        FINTWIN_ENV: "staging",
        DATABASE_URL: "postgresql://u:p@db/fintwin_live",
        AUTH_SECRET: secret,
      }),
    /reservada ao ambiente production|não pertence ao ambiente staging/,
  );
});

test("Vercel (VERCEL=1) permite arquivo JSONL desligado em staging", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  assert.doesNotThrow(() =>
    validateEnvironment({
      VERCEL: "1",
      FINTWIN_ENV: "staging",
      DATABASE_URL: "postgresql://u:p@ep-neon.aws/fintwin_staging?sslmode=require",
      AUTH_SECRET: secret,
      FINTWIN_PUBLIC_URL: "https://fintwin.vercel.app",
      FINTWIN_ENFORCE_TLS: "1",
      FINTWIN_DOCUMENT_ENCRYPTION_KEY: key,
      FINTWIN_DOCUMENT_ENCRYPTION_KEY_ID: "staging-documents-v1",
      FINTWIN_AUDIT_SIGNING_KEY: "staging-audit-signing-key-with-32-characters",
      FINTWIN_AUDIT_SIGNING_KEY_ID: "staging-audit-v1",
      FINTWIN_REQUIRE_ENCRYPTED_DOCUMENTS: "1",
      FINTWIN_AUDIT_ARCHIVE_REQUIRED: "0",
    }),
  );
});

test("staging local Docker (Path A) aceita Postgres sem TLS na rede compose", () => {
  const key = Buffer.alloc(32, 5).toString("base64");
  assert.doesNotThrow(() =>
    validateEnvironment({
      FINTWIN_ENV: "staging",
      FINTWIN_STAGING_LOCAL: "1",
      DATABASE_URL:
        "postgresql://fintwin:fintwin@127.0.0.1:5434/fintwin_staging?schema=public&sslmode=prefer",
      AUTH_SECRET: secret,
      FINTWIN_PUBLIC_URL: "https://staging-local.trycloudflare.com",
      FINTWIN_ENFORCE_TLS: "1",
      FINTWIN_DOCUMENT_ENCRYPTION_KEY: key,
      FINTWIN_DOCUMENT_ENCRYPTION_KEY_ID: "staging-documents-v1",
      FINTWIN_AUDIT_SIGNING_KEY: "staging-audit-signing-key-with-32-characters",
      FINTWIN_AUDIT_SIGNING_KEY_ID: "staging-audit-v1",
      FINTWIN_REQUIRE_ENCRYPTED_DOCUMENTS: "1",
      FINTWIN_AUDIT_ARCHIVE_REQUIRED: "1",
    }),
  );
});

test("uma substituição explícita não pode reutilizar a base de outro ambiente", () => {
  assert.throws(
    () =>
      validateEnvironment({
        FINTWIN_ENV: "production",
        FINTWIN_EXPECTED_DATABASE: "fintwin_staging",
        DATABASE_URL: "postgresql://u:p@db/fintwin_staging",
        AUTH_SECRET: secret,
      }),
    /reservada ao ambiente staging/,
  );
});

