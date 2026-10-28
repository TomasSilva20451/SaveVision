/**
 * Cria/atualiza Tomás e Telmo em qualquer base local (incl. fintwin_e2e).
 * Uso: FINTWIN_TOMAS_EMAIL=... FINTWIN_TOMAS_PASSWORD=... (idem Telmo) DATABASE_URL=... node scripts/upsert-local-users.mjs
 */
import "dotenv/config";
import { hashPassword } from "../src/lib/auth/password.ts";
import { db } from "../src/lib/db.ts";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável em falta: ${name}`);
  return value;
}

async function ensurePersonalWorkspace(userId, name) {
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
      data: { workspaceId: workspace.id, userId, role: "OWNER", status: "ACTIVE", joinedAt: new Date() },
    });
  });
}

const accounts = [
  { name: "Tomás", email: required("FINTWIN_TOMAS_EMAIL").toLowerCase(), password: required("FINTWIN_TOMAS_PASSWORD") },
  { name: "Telmo", email: required("FINTWIN_TELMO_EMAIL").toLowerCase(), password: required("FINTWIN_TELMO_PASSWORD") },
];

for (const account of accounts) {
  if (account.password.length < 14) throw new Error("Palavra-passe com mínimo 14 caracteres.");
  const passwordHash = await hashPassword(account.password);
  const verifiedAt = new Date();
  const user = await db.user.upsert({
    where: { email: account.email },
    update: {
      name: account.name,
      passwordHash,
      emailVerifiedAt: verifiedAt,
      disabledAt: null,
      systemRole: "ADMIN",
    },
    create: {
      name: account.name,
      email: account.email,
      passwordHash,
      emailVerifiedAt: verifiedAt,
      systemRole: "ADMIN",
    },
  });
  await ensurePersonalWorkspace(user.id, account.name);
  console.log(`OK ${account.email} (${new URL(process.env.DATABASE_URL).pathname.slice(1)})`);
}

await db.$disconnect();
