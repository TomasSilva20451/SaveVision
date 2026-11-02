import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": path.join(rootDir, "src/test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Os testes de integração partilham a base E2E e medem saldos/contagens.
    // Executá-los em paralelo cria interferência entre ficheiros distintos.
    fileParallelism: false,
  },
});
