import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type DbClient = typeof import("@/lib/db").db;

describe("FinancialAlert (PostgreSQL)", () => {
  let ready = false;
  let db: DbClient;
  let joaoId = "";
  let joaoWs = "";
  let syncFinancialAlerts: typeof import("@/server/services/financial-alerts").syncFinancialAlerts;

  beforeAll(async () => {
    await import("dotenv/config");
    if (!process.env.DATABASE_URL) return;
    try {
      ({ db } = await import("@/lib/db"));
      await db.$queryRaw`SELECT 1`;
    } catch {
      return;
    }
    syncFinancialAlerts = (await import("@/server/services/financial-alerts")).syncFinancialAlerts;

    const joao = await db.user.findUnique({ where: { email: "user1@example.local" } });
    if (!joao) return;
    joaoId = joao.id;
    const membership = await db.workspaceMember.findFirst({
      where: { userId: joaoId, status: "ACTIVE", workspace: { type: "PERSONAL" } },
      include: { workspace: true },
    });
    if (!membership) return;
    joaoWs = membership.workspaceId;
    ready = true;
  });

  it("upsert idempotente com deduplicationKey", async () => {
    if (!ready) return;

    const key = `${joaoWs}:INTEGRATION_TEST:${Date.now()}`;
    await db.financialAlert.create({
      data: {
        workspaceId: joaoWs,
        type: "BUDGET_EXCEEDED",
        severity: "ATTENTION",
        title: "Teste integração",
        description: "Alerta de teste",
        deduplicationKey: key,
      },
    });

    await db.financialAlert.upsert({
      where: { workspaceId_deduplicationKey: { workspaceId: joaoWs, deduplicationKey: key } },
      create: {
        workspaceId: joaoWs,
        type: "BUDGET_EXCEEDED",
        severity: "ATTENTION",
        title: "novo",
        description: "Alerta de teste",
        deduplicationKey: key,
      },
      update: { title: "atualizado", lastEvaluatedAt: new Date() },
    });

    const row = await db.financialAlert.findUnique({
      where: { workspaceId_deduplicationKey: { workspaceId: joaoWs, deduplicationKey: key } },
    });
    expect(row?.title).toBe("atualizado");

    await db.financialAlert.deleteMany({ where: { deduplicationKey: key } });
  });

  it("syncFinancialAlerts não duplica ao correr duas vezes", async () => {
    if (!ready) return;
    await syncFinancialAlerts(joaoId, joaoWs);
    const afterFirst = await db.financialAlert.count({
      where: { workspaceId: joaoWs, status: "ACTIVE" },
    });
    await syncFinancialAlerts(joaoId, joaoWs);
    const afterSecond = await db.financialAlert.count({
      where: { workspaceId: joaoWs, status: "ACTIVE" },
    });
    expect(afterSecond).toBe(afterFirst);
  });

  it("estado pessoal seen por utilizador", async () => {
    if (!ready) return;
    const alert = await db.financialAlert.findFirst({ where: { workspaceId: joaoWs } });
    if (!alert) return;

    await db.financialAlertUserState.upsert({
      where: { alertId_userId: { alertId: alert.id, userId: joaoId } },
      create: { alertId: alert.id, userId: joaoId, seenAt: new Date() },
      update: { seenAt: new Date() },
    });

    const state = await db.financialAlertUserState.findUnique({
      where: { alertId_userId: { alertId: alert.id, userId: joaoId } },
    });
    expect(state?.seenAt).not.toBeNull();
  });
});
