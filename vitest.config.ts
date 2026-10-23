import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Os testes de integração partilham a base E2E e medem saldos/contagens.
    // Executá-los em paralelo cria interferência entre ficheiros distintos.
    fileParallelism: false,
  },
});
