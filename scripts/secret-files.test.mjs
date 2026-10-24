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

test("recusa valor permanente e ficheiro em simultâneo", () => {
  assert.throws(
    () => resolveSecretFiles({ AUTH_SECRET: "inline", AUTH_SECRET_FILE: "/run/secrets/auth" }),
    /não podem ser usados em simultâneo/,
  );
});

