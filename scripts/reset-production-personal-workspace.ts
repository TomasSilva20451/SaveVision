import "dotenv/config";
import { db } from "../src/lib/db";
import { localDocumentStorage } from "../src/server/storage/local-files";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável obrigatória em falta: ${name}`);
  return value;
}

function validateTarget() {
  if (process.env.FINTWIN_RESET_CONFIRM !== "DELETE_PERSONAL_WORKSPACE") {
    throw new Error("Confirmação explícita em falta.");
  }

  const databaseName = new URL(required("DATABASE_URL")).pathname.slice(1).toLowerCase();
  if (!databaseName || /(demo|e2e|test)/.test(databaseName)) {
    throw new Error(`Base inválida para esta operação: ${databaseName || "sem nome"}`);
  }

  return required("FINTWIN_RESET_USER_EMAIL").toLowerCase();
}

async function main() {
  const email = validateTarget();
  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      memberships: {
        where: { status: "ACTIVE", workspace: { type: "PERSONAL" } },
        select: {
          workspace: {
            select: {
              id: true,
              name: true,
              storedDocuments: { select: { storageKey: true } },
            },
          },
        },
      },
    },
  });

  if (!user) throw new Error(`Utilizador inexistente: ${email}`);
  if (user.memberships.length !== 1) {
    throw new Error(`Esperado um único workspace pessoal; encontrados ${user.memberships.length}.`);
  }

  const previous = user.memberships[0]!.workspace;
  const replacement = await db.$transaction(async (tx) => {
    await tx.workspace.delete({ where: { id: previous.id } });
    const workspace = await tx.workspace.create({
      data: { name: user.name, type: "PERSONAL", createdById: user.id },
    });
    await tx.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: "OWNER",
        status: "ACTIVE",
        joinedAt: new Date(),
      },
    });
    return workspace;
  });

  await Promise.all(
    previous.storedDocuments.map(({ storageKey }) => localDocumentStorage.delete(storageKey)),
  );

  console.log(`Workspace pessoal reposto: ${user.name} (${previous.id} -> ${replacement.id}).`);
  console.log("Utilizador, perfil e memberships conjuntos preservados; dados financeiros pessoais removidos.");
}

main()
  .then(async () => db.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
