import assert from "node:assert/strict";
import test from "node:test";
import { mapDeploymentSecretFiles, resolveSecretFiles } from "./secret-files.mjs";

test("resolve um segredo a partir de ficheiro montado", () => {
  const resolved = resolveSecretFiles(
    { AUTH_SECRET_FILE: "/run/secrets/auth" },
    (file) => (file === "/run/secrets/auth" ? "  segredo-montado  \n" : ""),
  );
  assert.equal(resolved.AUTH_SECRET, "segredo-montado");
});

test("e2e não mapeia ficheiros de segredo de staging", () => {
  const env = mapDeploymentSecretFiles({
    FINTWIN_ENV: "e2e",
    DATABASE_URL: "postgresql://local/e2e",
    FINTWIN_DATABASE_URL_SECRET_FILE: "/etc/fintwin/staging/database-url",
  });
  assert.equal(env.DATABASE_URL_FILE, undefined);
});

test("produção com segredos inline não cria caminhos undefined", () => {
  const env = mapDeploymentSecretFiles({
    FINTWIN_ENV: "production",
    DATABASE_URL: "postgresql://local/fintwin_live",
    AUTH_SECRET: "inline",
  });
  assert.equal(env.DATABASE_URL_FILE, undefined);
  assert.equal(env.AUTH_SECRET_FILE, undefined);
});

test("recusa valor permanente e ficheiro em simultâneo", () => {
  assert.throws(
    () => resolveSecretFiles({ AUTH_SECRET: "inline", AUTH_SECRET_FILE: "/run/secrets/auth" }),
    /não podem ser usados em simultâneo/,
  );
});

test("deploy local: inline DATABASE_URL ignora caminho Docker", () => {
  const env = {
    FINTWIN_ENV: "production",
    DATABASE_URL: "postgresql://local/fintwin_live",
    FINTWIN_DATABASE_URL_SECRET_FILE: "/etc/fintwin/production/database-url",
  };
  mapDeploymentSecretFiles(env);
  if (env.DATABASE_URL?.trim()) {
    delete env.DATABASE_URL_FILE;
  }
  assert.equal(env.DATABASE_URL_FILE, undefined);
  const resolved = resolveSecretFiles(env);
  assert.equal(resolved.DATABASE_URL, "postgresql://local/fintwin_live");
});

