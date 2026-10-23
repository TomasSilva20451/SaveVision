import "dotenv/config";
import { demoUsers } from "../src/lib/auth/demo-users";
import { hashPassword } from "../src/lib/auth/password";
import { db } from "../src/lib/db";

const seedProfile = process.env.FINTWIN_SEED_PROFILE;
const environment = process.env.FINTWIN_ENV;
const databaseUrl = process.env.DATABASE_URL;

if (seedProfile !== "demo" && seedProfile !== "e2e") {
  throw new Error(
    "Seed bloqueado: define FINTWIN_SEED_PROFILE=demo ou FINTWIN_SEED_PROFILE=e2e. " +
      "Staging e produção nunca recebem dados fictícios.",
  );
}

if (environment !== seedProfile) {
  throw new Error(
    `Seed bloqueado: FINTWIN_ENV=${environment ?? "(vazio)"} não corresponde a ` +
      `FINTWIN_SEED_PROFILE=${seedProfile}.`,
  );
}

if (!databaseUrl) {
  throw new Error("Seed bloqueado: DATABASE_URL em falta.");
}

const seedDatabaseName = new URL(databaseUrl).pathname.replace(/^\//, "");
const expectedSeedDatabase = seedProfile === "demo" ? "fintwin_demo_ui" : "fintwin_e2e";
const matchesSeedDatabase =
  seedProfile === "demo"
    ? seedDatabaseName === expectedSeedDatabase
    : seedDatabaseName === expectedSeedDatabase || seedDatabaseName.endsWith("_e2e");
if (!matchesSeedDatabase) {
  throw new Error(
    `Seed bloqueado: ${seedProfile} só pode escrever em ${expectedSeedDatabase}, ` +
      `não em ${seedDatabaseName || "uma base sem nome"}.`,
  );
}

async function ensurePersonalWorkspace(userId: string, name: string) {
  const existing = await db.workspaceMember.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      workspace: { type: "PERSONAL" },
    },
    include: { workspace: true },
  });

  if (existing) {
    return existing.workspace;
  }

  return db.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name,
        type: "PERSONAL",
        createdById: userId,
      },
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

    return workspace;
  });
}

async function seedDemoAccounts(workspaceId: string, userId: string) {
  const accountCount = await db.financialAccount.count({
    where: { workspaceId },
  });

  if (accountCount > 0) {
    return db.financialAccount.findMany({ where: { workspaceId } });
  }

  await db.financialAccount.createMany({
    data: [
      {
        workspaceId,
        ownerUserId: userId,
        name: "Conta à ordem",
        type: "CURRENT",
        openingBalance: "1500",
      },
      {
        workspaceId,
        ownerUserId: userId,
        name: "Poupança",
        type: "SAVINGS",
        openingBalance: "800",
      },
    ],
  });

  return db.financialAccount.findMany({ where: { workspaceId } });
}

async function seedSampleMovements(
  workspaceId: string,
  userId: string,
  currentAccountId: string,
) {
  const existing = await db.transaction.count({ where: { workspaceId } });
  if (existing > 0) return;

  const categories = [
    { name: "Alimentação", nature: "NECESSARY" as const, behavior: "VARIABLE" as const },
    { name: "Lazer", nature: "DISCRETIONARY" as const, behavior: "VARIABLE" as const },
  ];

  for (const category of categories) {
    await db.category.upsert({
      where: { workspaceId_name: { workspaceId, name: category.name } },
      update: {},
      create: { workspaceId, ...category },
    });
  }

  const food = await db.category.findFirst({
    where: { workspaceId, name: "Alimentação" },
  });

  const now = new Date();
  await db.transaction.createMany({
    data: [
      {
        workspaceId,
        accountId: currentAccountId,
        userId,
        type: "INCOME",
        status: "COMPLETED",
        amount: "2200",
        occurredAt: now,
        description: "Salário (demo)",
      },
      {
        workspaceId,
        accountId: currentAccountId,
        userId,
        type: "EXPENSE",
        status: "COMPLETED",
        amount: "-320.50",
        occurredAt: now,
        description: "Supermercado",
        categoryId: food?.id,
      },
    ],
  });
}

async function seedPlanning(workspaceId: string, userId: string) {
  const goalCount = await db.savingsGoal.count({ where: { workspaceId } });
  if (goalCount > 0) return;

  await db.workspacePlanningSettings.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      emergencyFundTargetMonths: 6,
      monthlyEssentialExpenses: "900",
    },
    update: {},
  });

  const goal = await db.savingsGoal.create({
    data: {
      workspaceId,
      userId,
      title: "Férias de verão",
      targetAmount: "2000",
      kind: "GENERAL",
    },
  });

  await db.savingsGoalContribution.create({
    data: {
      workspaceId,
      goalId: goal.id,
      userId,
      amount: "450",
      contributedAt: new Date(),
    },
  });

  await db.cgdProductRegistry.create({
    data: {
      workspaceId,
      userId,
      label: "Produto poupança (referência manual)",
      category: "SAVINGS",
      notes: "Registo informativo sem taxas simuladas.",
    },
  });
}

async function ensureJointWorkspace(userIds: { joao: string; maria: string }) {
  const existing = await db.workspace.findFirst({
    where: { type: "JOINT", name: "Casa João e Maria" },
  });
  if (existing) return existing;

  return db.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name: "Casa João e Maria",
        type: "JOINT",
        createdById: userIds.joao,
      },
    });

    await tx.workspaceMember.createMany({
      data: [
        {
          workspaceId: workspace.id,
          userId: userIds.joao,
          role: "OWNER",
          status: "ACTIVE",
          joinedAt: new Date(),
        },
        {
          workspaceId: workspace.id,
          userId: userIds.maria,
          role: "MEMBER",
          status: "ACTIVE",
          joinedAt: new Date(),
        },
      ],
    });

    await tx.financialAccount.create({
      data: {
        workspaceId: workspace.id,
        name: "Conta conjunta",
        type: "CURRENT",
        openingBalance: "500",
      },
    });

    await tx.savingsGoal.create({
      data: {
        workspaceId: workspace.id,
        userId: userIds.joao,
        title: "Reforma da cozinha",
        targetAmount: "5000",
        kind: "GENERAL",
      },
    });

    return workspace;
  });
}

async function main() {
  const userIds: Record<string, string> = {};

  for (const demoUser of demoUsers) {
    const passwordHash = await hashPassword(demoUser.password);

    const user = await db.user.upsert({
      where: { email: demoUser.email },
      update: {
        name: demoUser.name,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
      create: {
        email: demoUser.email,
        name: demoUser.name,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    });

    userIds[demoUser.email] = user.id;

    const workspace = await ensurePersonalWorkspace(user.id, demoUser.name);
    const accounts = await seedDemoAccounts(workspace.id, user.id);
    const current = accounts.find((a) => a.type === "CURRENT");
    if (current) {
      await seedSampleMovements(workspace.id, user.id, current.id);
    }
    if (demoUser.email === "user1@example.local") {
      await seedPlanning(workspace.id, user.id);
      const positions = await db.investmentPosition.count({
        where: { workspaceId: workspace.id },
      });
      if (positions === 0) {
        await db.investmentPosition.create({
          data: {
            workspaceId: workspace.id,
            userId: user.id,
            assetClass: "ETF",
            symbol: "IWDA",
            name: "iShares Core MSCI World",
            quantity: "5",
            costBasis: "500",
            manualPrice: "110",
          },
        });
      }
    }
  }

  const joao = userIds["user1@example.local"];
  const maria = userIds["user2@example.local"];
  if (joao && maria) {
    await ensureJointWorkspace({ joao, maria });
  }
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
