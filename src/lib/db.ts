import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const databaseNamesByEnvironment = {
  demo: ["fintwin_demo_ui"],
  e2e: ["fintwin_e2e"],
  staging: ["fintwin_staging"],
  production: ["fintwin_live", "fintwin_production"],
} as const;

function assertRuntimeDatabase(connectionString: string) {
  const environment = process.env.FINTWIN_ENV;
  if (!environment || environment === "development") return;
  if (!(environment in databaseNamesByEnvironment)) {
    throw new Error(`FINTWIN_ENV inválido no runtime: ${environment}.`);
  }

  const databaseName = new URL(connectionString).pathname.replace(/^\//, "");
  const reservedOwner = Object.entries(databaseNamesByEnvironment).find(
    ([, names]) => (names as readonly string[]).includes(databaseName),
  )?.[0];
  if (reservedOwner && reservedOwner !== environment) {
    throw new Error(
      `A base «${databaseName}» está reservada ao runtime ${reservedOwner}, ` +
        `não a ${environment}.`,
    );
  }
  const expected = process.env.FINTWIN_EXPECTED_DATABASE;
  const accepted = expected
    ? [expected]
    : [...databaseNamesByEnvironment[
        environment as keyof typeof databaseNamesByEnvironment
      ]];
  if (!accepted.includes(databaseName)) {
    throw new Error(
      `A base «${databaseName}» não pertence ao runtime ${environment}. ` +
        `Esperado: ${accepted.join(" ou ")}.`,
    );
  }
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL não está definida.");
  }

  assertRuntimeDatabase(connectionString);

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
