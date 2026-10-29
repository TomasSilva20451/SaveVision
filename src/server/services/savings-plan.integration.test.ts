import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { assertE2eCleanupAllowed } from "@/lib/e2e/cleanup-policy";

type DbClient = typeof import("@/lib/db").db;

describe("SavingsPlan (PostgreSQL)", () => {
  let ready = false;
  let db: DbClient;
  let joaoId = "";
  let joaoPersonalWs = "";
  let mariaId = "";
  let jointWs = "";
  let activateSavingsPlan: typeof import("@/server/services/savings-plan").activateSavingsPlan;
  let buildSavingsPlanActivationPreview: typeof import("@/server/services/savings-plan").buildSavingsPlanActivationPreview;
  let setSavingsPlanStatus: typeof import("@/server/services/savings-plan").setSavingsPlanStatus;
  let getSavingsPlanDetail: typeof import("@/server/services/savings-plan").getSavingsPlanDetail;
  let registerSavingsPlanWeeklyContribution: typeof import("@/server/services/savings-plan").registerSavingsPlanWeeklyContribution;

  beforeAll(async () => {
    await import("dotenv/config");
    if (!process.env.DATABASE_URL) return;
    try {
      assertE2eCleanupAllowed(process.env.DATABASE_URL);
    } catch {
      return;
    }
    try {
      ({ db } = await import("@/lib/db"));
      await db.$queryRaw`SELECT 1`;
    } catch {
      return;
    }
    const mod = await import("@/server/services/savings-plan");
    activateSavingsPlan = mod.activateSavingsPlan;
    buildSavingsPlanActivationPreview = mod.buildSavingsPlanActivationPreview;
    setSavingsPlanStatus = mod.setSavingsPlanStatus;
    getSavingsPlanDetail = mod.getSavingsPlanDetail;
    registerSavingsPlanWeeklyContribution = mod.registerSavingsPlanWeeklyContribution;

    const joao = await db.user.findUnique({ where: { email: "user1@example.local" } });
    const maria = await db.user.findUnique({ where: { email: "user2@example.local" } });
    if (!joao || !maria) return;
    joaoId = joao.id;
    mariaId = maria.id;
    const joaoMember = await db.workspaceMember.findFirst({
      where: { userId: joaoId, status: "ACTIVE", workspace: { type: "PERSONAL" } },
    });
    const jointMember = await db.workspaceMember.findFirst({
      where: { userId: joaoId, status: "ACTIVE", workspace: { type: "JOINT" } },
    });
    if (!joaoMember) return;
    joaoPersonalWs = joaoMember.workspaceId;
    jointWs = jointMember?.workspaceId ?? "";
    ready = true;
  });

  function wizardInput(suffix: string) {
    return {
      name: `E2E Plano ${suffix}`,
      targetAmount: "300.00",
      targetDateIso: "2027-01-20",
      plannedWeeklyContribution: "25.00",
      contributionWeekday: 7,
      reviewWeekday: 7,
      alertThresholdPercent: 75,
      createSavingsAccountName: `Poupança E2E ${suffix}`,
      budgetStartMode: "NEXT_MONTH" as const,
      budgetLines: [
        {
          categoryName: `E2E Cat ${suffix}`,
          monthlyLimit: "50.00",
          nature: "NECESSARY" as const,
          behavior: "VARIABLE" as const,
        },
      ],
      confirmBudgetOverrides: true,
      idempotencyKey: `e2e-plan-${suffix}`,
    };
  }

  it("activação atómica sem transacções nem contribuições", async () => {
    if (!ready) return;
    const suffix = String(Date.now());
    const input = wizardInput(suffix);
    const txBefore = await db.transaction.count({ where: { workspaceId: joaoPersonalWs } });
    const contribBefore = await db.savingsGoalContribution.count({ where: { workspaceId: joaoPersonalWs } });

    const result = await activateSavingsPlan(joaoId, joaoPersonalWs, input);
    expect(result).not.toBeNull();
    expect(result!.reused).toBe(false);

    const txAfter = await db.transaction.count({ where: { workspaceId: joaoPersonalWs } });
    const contribAfter = await db.savingsGoalContribution.count({ where: { workspaceId: joaoPersonalWs } });
    expect(txAfter).toBe(txBefore);
    expect(contribAfter).toBe(contribBefore);

    const plan = await db.savingsPlan.findUnique({
      where: { workspaceId_activationKey: { workspaceId: joaoPersonalWs, activationKey: input.idempotencyKey } },
      include: { goal: true, checkIns: true },
    });
    expect(plan?.status).toBe("ACTIVE");
    expect(plan!.checkIns.length).toBeGreaterThan(0);
    expect(plan!.checkIns.every((c) => c.status === "DUE")).toBe(true);

    const audit = await db.auditEvent.findFirst({
      where: { resourceType: "SavingsPlan", resourceId: plan!.id, action: "SAVINGS_PLAN_ACTIVATED" },
      orderBy: { occurredAt: "desc" },
    });
    expect(audit).not.toBeNull();
  });

  it("idempotência por activationKey", async () => {
    if (!ready) return;
    const suffix = `idem-${Date.now()}`;
    const input = wizardInput(suffix);
    const first = await activateSavingsPlan(joaoId, joaoPersonalWs, input);
    const second = await activateSavingsPlan(joaoId, joaoPersonalWs, input);
    expect(first?.planId).toBe(second?.planId);
    expect(second?.reused).toBe(true);
    const count = await db.savingsPlan.count({
      where: { workspaceId: joaoPersonalWs, activationKey: input.idempotencyKey },
    });
    expect(count).toBe(1);
  });

  it("recusa workspace conjunto", async () => {
    if (!ready || !jointWs) return;
    const input = wizardInput(`joint-${Date.now()}`);
    const result = await activateSavingsPlan(joaoId, jointWs, input);
    expect(result).toBeNull();
  });

  it("isolamento — outro utilizador não vê plano pessoal", async () => {
    if (!ready) return;
    const suffix = `iso-${Date.now()}`;
    const input = wizardInput(suffix);
    const activated = await activateSavingsPlan(joaoId, joaoPersonalWs, input);
    expect(activated).not.toBeNull();
    const mariaView = await getSavingsPlanDetail(mariaId, joaoPersonalWs, activated!.planId);
    expect(mariaView).toBeNull();
  });

  it("cancelamento não apaga objetivo nem conta", async () => {
    if (!ready) return;
    const suffix = `cancel-${Date.now()}`;
    const input = wizardInput(suffix);
    const activated = await activateSavingsPlan(joaoId, joaoPersonalWs, input);
    if (!activated) return;
    const before = await db.savingsPlan.findUnique({
      where: { id: activated.planId },
      include: { goal: true, savingsAccount: true },
    });
    await setSavingsPlanStatus(joaoId, joaoPersonalWs, activated.planId, "CANCELLED");
    const goal = await db.savingsGoal.findUnique({ where: { id: before!.goalId } });
    const account = await db.financialAccount.findUnique({ where: { id: before!.savingsAccountId } });
    expect(goal).not.toBeNull();
    expect(account).not.toBeNull();
    const plan = await db.savingsPlan.findUnique({ where: { id: activated.planId } });
    expect(plan?.status).toBe("CANCELLED");
  });

  it("contribuição manual completa check-in", async () => {
    if (!ready) return;
    const suffix = `contrib-${Date.now()}`;
    const input = wizardInput(suffix);
    const activated = await activateSavingsPlan(joaoId, joaoPersonalWs, input);
    if (!activated) return;
    const checkIn = await db.savingsPlanCheckIn.findFirst({
      where: { savingsPlanId: activated.planId, status: "DUE" },
      orderBy: { periodStart: "asc" },
    });
    if (!checkIn) return;
    const result = await registerSavingsPlanWeeklyContribution(joaoId, joaoPersonalWs, {
      planId: activated.planId,
      checkInId: checkIn.id,
      amount: "25.00",
      contributedAt: new Date(),
      transferConfirmed: true,
    });
    expect(result).not.toBeNull();
    const updated = await db.savingsPlanCheckIn.findUnique({ where: { id: checkIn.id } });
    expect(updated?.status).toBe("COMPLETED");
    expect(updated?.contributionId).not.toBeNull();
  });

  it("pré-visualização declara zero transacções", async () => {
    if (!ready) return;
    const preview = await buildSavingsPlanActivationPreview(
      joaoId,
      joaoPersonalWs,
      wizardInput(`prev-${Date.now()}`),
    );
    expect(preview?.noTransactionsCreated).toBe(true);
    expect(preview?.initialAccountBalance).toBe("0.00");
  });
});
