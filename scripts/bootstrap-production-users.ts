import "dotenv/config";
import { hashPassword } from "../src/lib/auth/password";
import { db } from "../src/lib/db";

type BootstrapUser = {
  name: "Tomás" | "Telmo";
  email: string;
  password: string;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável obrigatória em falta: ${name}`);
  return value;
}

function validateDatabaseTarget() {
  if (process.env.FINTWIN_PRODUCTION_BOOTSTRAP !== "yes") {
    throw new Error("Define FINTWIN_PRODUCTION_BOOTSTRAP=yes para autorizar o bootstrap não destrutivo.");
  }

  const databaseUrl = required("DATABASE_URL");
  const databaseName = new URL(databaseUrl).pathname.slice(1).toLowerCase();
  if (!databaseName || /(demo|e2e|test)/.test(databaseName)) {
    throw new Error(`Base inválida para produção: ${databaseName || "sem nome"}`);
  }
}

async function ensurePersonalWorkspace(userId: string, name: string) {
  const membership = await db.workspaceMember.findFirst({
    where: { userId, status: "ACTIVE", workspace: { type: "PERSONAL" } },
    select: { workspaceId: true },
  });
  if (membership) return;

  await db.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: { name, type: "PERSONAL", createdById: userId },
    });
    await tx.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId,
        role: "OWNER",
        status: "ACTIVE",
        joinedAt: new Date(),
      },
    });
  });
}

async function main() {
  validateDatabaseTarget();

  const users: BootstrapUser[] = [
    {
      name: "Tomás",
      email: required("FINTWIN_TOMAS_EMAIL").toLowerCase(),
      password: required("FINTWIN_TOMAS_PASSWORD"),
    },
    {
      name: "Telmo",
      email: required("FINTWIN_TELMO_EMAIL").toLowerCase(),
      password: required("FINTWIN_TELMO_PASSWORD"),
    },
  ];

  if (users.some((user) => user.password.length < 14)) {
    throw new Error("As palavras-passe iniciais têm de ter pelo menos 14 caracteres.");
  }
  if (new Set(users.map((user) => user.email)).size !== users.length) {
    throw new Error("Tomás e Telmo precisam de emails distintos.");
  }

  for (const account of users) {
    const passwordHash = await hashPassword(account.password);
    const verifiedAt = new Date();
    const user = await db.user.upsert({
      where: { email: account.email },
      update: { name: account.name, passwordHash, emailVerifiedAt: verifiedAt, disabledAt: null },
      create: {
        name: account.name,
        email: account.email,
        passwordHash,
        emailVerifiedAt: verifiedAt,
      },
    });
    await ensurePersonalWorkspace(user.id, account.name);
    console.log(`Conta pronta: ${account.name} <${account.email}>`);
  }

  console.log("Bootstrap concluído sem criar contas financeiras, movimentos, objetivos ou outros dados fictícios.");
}

main()
  .then(async () => db.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
