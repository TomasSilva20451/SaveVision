import assert from "node:assert/strict";
import test from "node:test";
import { resolveSecretFiles } from "./secret-files.mjs";

test("resolve um segredo a partir de ficheiro montado", () => {
  const resolved = resolveSecretFiles(
    { AUTH_SECRET_FILE: "/run/secrets/auth" },
    (file) => (file === "/run/secrets/auth" ? "  segredo-montado  \n" : ""),
  );
  assert.equal(resolved.AUTH_SECRET, "segredo-montado");
});

test("recusa valor permanente e ficheiro em simultâneo", () => {
  assert.throws(
    () => resolveSecretFiles({ AUTH_SECRET: "inline", AUTH_SECRET_FILE: "/run/secrets/auth" }),
    /não podem ser usados em simultâneo/,
  );
});

