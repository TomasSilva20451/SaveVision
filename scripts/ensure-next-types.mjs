import fs from "node:fs";
import path from "node:path";

const marker = path.join(process.cwd(), ".next", "types", "routes.d.ts");

if (!fs.existsSync(marker)) {
  console.error(
    "[typecheck] Tipos gerados em falta (.next/types). " +
      "Executa `pnpm build` antes de `pnpm typecheck`, " +
      "ou evita `next dev` e `next build` em simultâneo na mesma pasta .next.",
  );
  process.exit(1);
}
