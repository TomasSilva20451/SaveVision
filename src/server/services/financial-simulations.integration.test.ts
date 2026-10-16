import { beforeAll, describe, expect, it } from "vitest";

type DbClient = typeof import("@/lib/db").db;

describe("getSimulationBaseline (PostgreSQL)", () => {
  let ready = false;
  let db: DbClient;
  let joaoId = "";
  let joaoWs = "";
  let getSimulationBaseline: typeof import("@/server/services/financial-simulations").getSimulationBaseline;

  beforeAll(async () => {
    await import("dotenv/config");
    if (!process.env.DATABASE_URL) return;
    try {
      ({ db } = await import("@/lib/db"));
      await db.$queryRaw`SELECT 1`;
    } catch {
      return;
    }
    getSimulationBaseline = (await import("@/server/services/financial-simulations"))
      .getSimulationBaseline;
    const joao = await db.user.findUnique({ where: { email: "user1@example.local" } });
    if (!joao) return;
    joaoId = joao.id;
    const membership = await db.workspaceMember.findFirst({
      where: { userId: joaoId, status: "ACTIVE", workspace: { type: "PERSONAL" } },
    });
    if (!membership) return;
    joaoWs = membership.workspaceId;
    ready = true;
  });

  it("não altera contagem de transações ao consultar baseline", async () => {
    if (!ready) return;
    const before = await db.transaction.count({ where: { workspaceId: joaoWs } });
    const baseline = await getSimulationBaseline(joaoId, joaoWs);
    const after = await db.transaction.count({ where: { workspaceId: joaoWs } });
    expect(baseline).not.toBeNull();
    expect(after).toBe(before);
  });
});
