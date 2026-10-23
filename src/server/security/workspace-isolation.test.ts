import { afterAll, beforeAll, describe, expect, it } from "vitest";

type DbClient = typeof import("@/lib/db").db;

describe("isolamento entre utilizadores (servidor + PostgreSQL)", () => {
  let ready = false;
  let db: DbClient;
  let joaoId = "";
  let mariaId = "";
  let joaoPersonalWs = "";
  let mariaPersonalWs = "";
  let mariaAccountId = "";
  const createdWorkspaceIds: string[] = [];
  const createdUserIds: string[] = [];
  let listAccountsWithBalances: typeof import("@/server/services/accounts").listAccountsWithBalances;
  let createExpense: typeof import("@/server/services/expenses").createExpense;
  let buildFinancialReportCsv: typeof import("@/server/services/reports").buildFinancialReportCsv;
  let readDocumentBytes: typeof import("@/server/services/documents").readDocumentBytes;
  let listInvestmentPositions: typeof import("@/server/services/investments").listInvestmentPositions;
  let getPlanningOverview: typeof import("@/server/services/planning").getPlanningOverview;
  let getBudgetOverview: typeof import("@/server/services/budgets").getBudgetOverview;
  let getPatrimonyOverview: typeof import("@/server/services/patrimony").getPatrimonyOverview;
  let recordLiabilityPayment: typeof import("@/server/services/patrimony").recordLiabilityPayment;
  let captureNetWorthSnapshot: typeof import("@/server/services/net-worth-snapshot").captureNetWorthSnapshot;
  let createInvestmentPosition: typeof import("@/server/services/investments").createInvestmentPosition;
  let getRecurringExpensesOverview: typeof import("@/server/services/recurring-expenses").getRecurringExpensesOverview;
  let getTreasuryForecast: typeof import("@/server/services/treasury-forecast").getTreasuryForecast;
  let getFinancialInsightsOverview: typeof import("@/server/services/financial-insights").getFinancialInsightsOverview;
  let listMemberships: typeof import("@/server/repositories/workspaces").listMemberships;
  let canAccessWorkspace: typeof import("@/lib/permissions/workspace-policy").canAccessWorkspace;

  beforeAll(async () => {
    await import("dotenv/config");
    if (!process.env.DATABASE_URL) {
      ready = false;
      return;
    }

    try {
      ({ db } = await import("@/lib/db"));
      await db.$queryRaw`SELECT 1`;
    } catch {
      ready = false;
      return;
    }

    const accountsMod = await import("@/server/services/accounts");
    const expensesMod = await import("@/server/services/expenses");
    const reportsMod = await import("@/server/services/reports");
    const documentsMod = await import("@/server/services/documents");
    const investmentsMod = await import("@/server/services/investments");
    const planningMod = await import("@/server/services/planning");
    const budgetsMod = await import("@/server/services/budgets");
    const patrimonyMod = await import("@/server/services/patrimony");
    const workspacesMod = await import("@/server/repositories/workspaces");
    const policyMod = await import("@/lib/permissions/workspace-policy");

    listAccountsWithBalances = accountsMod.listAccountsWithBalances;
    createExpense = expensesMod.createExpense;
    buildFinancialReportCsv = reportsMod.buildFinancialReportCsv;
    readDocumentBytes = documentsMod.readDocumentBytes;
    listInvestmentPositions = investmentsMod.listInvestmentPositions;
    getPlanningOverview = planningMod.getPlanningOverview;
    getBudgetOverview = budgetsMod.getBudgetOverview;
    getPatrimonyOverview = patrimonyMod.getPatrimonyOverview;
    recordLiabilityPayment = patrimonyMod.recordLiabilityPayment;
    const snapshotMod = await import("@/server/services/net-worth-snapshot");
    captureNetWorthSnapshot = snapshotMod.captureNetWorthSnapshot;
    createInvestmentPosition = investmentsMod.createInvestmentPosition;
    const recurringMod = await import("@/server/services/recurring-expenses");
    getRecurringExpensesOverview = recurringMod.getRecurringExpensesOverview;
    getTreasuryForecast = (await import("@/server/services/treasury-forecast")).getTreasuryForecast;
    getFinancialInsightsOverview = (await import("@/server/services/financial-insights"))
      .getFinancialInsightsOverview;
    listMemberships = workspacesMod.listMemberships;
    canAccessWorkspace = policyMod.canAccessWorkspace;

    ready = true;

    const suffix = `${process.pid}-${Date.now()}`;
    await db.$transaction(async (tx) => {
      const joao = await tx.user.create({
        data: {
          email: `isolation-a-${suffix}@example.test`,
          name: "Utilizador A",
          passwordHash: "integration-test-only",
        },
      });
      const maria = await tx.user.create({
        data: {
          email: `isolation-b-${suffix}@example.test`,
          name: "Utilizador B",
          passwordHash: "integration-test-only",
        },
      });
      joaoId = joao.id;
      mariaId = maria.id;
      createdUserIds.push(joao.id, maria.id);

      const joaoWorkspace = await tx.workspace.create({
        data: { name: "Workspace A", type: "PERSONAL", createdById: joao.id },
      });
      const mariaWorkspace = await tx.workspace.create({
        data: { name: "Workspace B", type: "PERSONAL", createdById: maria.id },
      });
      joaoPersonalWs = joaoWorkspace.id;
      mariaPersonalWs = mariaWorkspace.id;
      createdWorkspaceIds.push(joaoWorkspace.id, mariaWorkspace.id);

      await tx.workspaceMember.createMany({
        data: [
          {
            workspaceId: joaoWorkspace.id,
            userId: joao.id,
            role: "OWNER",
            status: "ACTIVE",
            joinedAt: new Date(),
          },
          {
            workspaceId: mariaWorkspace.id,
            userId: maria.id,
            role: "OWNER",
            status: "ACTIVE",
            joinedAt: new Date(),
          },
        ],
      });

      const mariaAccount = await tx.financialAccount.create({
        data: {
          workspaceId: mariaWorkspace.id,
          ownerUserId: maria.id,
          name: "Conta B",
          type: "CURRENT",
          openingBalance: "100",
        },
      });
      mariaAccountId = mariaAccount.id;
    });
  });

  afterAll(async () => {
    if (!db) return;
    if (createdWorkspaceIds.length > 0) {
      await db.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    }
    if (createdUserIds.length > 0) {
      await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  it("base de dados acessível com fixtures próprias", () => {
    expect(ready).toBe(true);
  });

  it("utilizador A não lista contas do workspace pessoal B", async () => {
    if (!ready) return;
    const result = await listAccountsWithBalances(joaoId, mariaPersonalWs);
    expect(result).toBeNull();
  });

  it("utilizador B não lista contas do workspace pessoal A", async () => {
    if (!ready) return;
    const result = await listAccountsWithBalances(mariaId, joaoPersonalWs);
    expect(result).toBeNull();
  });

  it("utilizador A não cria despesa numa conta B", async () => {
    if (!ready || !mariaAccountId) return;
    const result = await createExpense(joaoId, joaoPersonalWs, {
      accountId: mariaAccountId,
      amount: "10",
      description: "Tentativa cross-workspace",
      occurredAt: new Date(),
    });
    expect(result).toBeNull();
  });

  it("utilizador A não exporta CSV do workspace B", async () => {
    if (!ready) return;
    const csv = await buildFinancialReportCsv(joaoId, mariaPersonalWs);
    expect(csv).toBeNull();
  });

  it("utilizador A não consulta investimentos do workspace B", async () => {
    if (!ready) return;
    const rows = await listInvestmentPositions(joaoId, mariaPersonalWs);
    expect(rows).toBeNull();
  });

  it("utilizador A não consulta planeamento do workspace B", async () => {
    if (!ready) return;
    const overview = await getPlanningOverview(joaoId, mariaPersonalWs);
    expect(overview).toBeNull();
  });

  it("utilizador A não consulta orçamentos do workspace B", async () => {
    if (!ready) return;
    const overview = await getBudgetOverview(joaoId, mariaPersonalWs, 2026, 1);
    expect(overview).toBeNull();
  });

  it("utilizador B não consulta património/passivos do workspace A", async () => {
    if (!ready) return;
    const overview = await getPatrimonyOverview(mariaId, joaoPersonalWs);
    expect(overview).toBeNull();
  });

  it("utilizador A não regista pagamento de passivo no workspace B", async () => {
    if (!ready) return;
    const liability = await db.financialLiability.findFirst({
      where: { workspaceId: mariaPersonalWs },
    });
    if (!liability) return;
    const result = await recordLiabilityPayment(joaoId, joaoPersonalWs, {
      liabilityId: liability.id,
      paidAt: new Date(),
      principalAmount: "1",
      interestAmount: "0",
      feesAmount: "0",
    });
    expect(result.ok).toBe(false);
  });

  it("utilizador A não captura snapshot patrimonial no workspace B", async () => {
    if (!ready) return;
    const snap = await captureNetWorthSnapshot(joaoId, mariaPersonalWs);
    expect(snap).toBeNull();
  });

  it("utilizador B não consulta análises do workspace A", async () => {
    if (!ready) return;
    const overview = await getFinancialInsightsOverview(mariaId, joaoPersonalWs);
    expect(overview).toBeNull();
  });

  it("utilizador B não consulta previsão de tesouraria do workspace A", async () => {
    if (!ready) return;
    const forecast = await getTreasuryForecast(mariaId, joaoPersonalWs, 30);
    expect(forecast).toBeNull();
  });

  it("utilizador B não consulta recorrências de despesas do workspace A", async () => {
    if (!ready) return;
    const overview = await getRecurringExpensesOverview(mariaId, joaoPersonalWs);
    expect(overview).toBeNull();
  });

  it("utilizador A não cria investimento ligado a conta B", async () => {
    if (!ready || !mariaAccountId) return;
    const row = await createInvestmentPosition(joaoId, joaoPersonalWs, {
      assetClass: "ETF",
      symbol: "ISO",
      name: "Cross link attempt",
      quantity: "1",
      costBasis: "100",
      manualPrice: "100",
      valuationMode: "ACCOUNT_COMPONENT",
      linkedAccountId: mariaAccountId,
    });
    expect(row).toBeNull();
  });

  it("membership impede utilizador A de aceder ao workspace B", async () => {
    if (!ready) return;
    const memberships = await listMemberships(joaoId);
    expect(canAccessWorkspace(memberships, mariaPersonalWs)).toBe(false);
  });

  it("documento do workspace B é inacessível no workspace A", async () => {
    if (!ready) return;
    let doc = await db.storedDocument.findFirst({
      where: { workspaceId: mariaPersonalWs },
    });
    if (!doc) {
      doc = await db.storedDocument.create({
        data: {
          workspaceId: mariaPersonalWs,
          userId: mariaId,
          originalName: "isolamento-test.pdf",
          mimeType: "application/pdf",
          sizeBytes: 4,
          storageKey: `test/${mariaPersonalWs}/isolamento-${Date.now()}`,
          sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        },
      });
    }
    const bytes = await readDocumentBytes(joaoId, joaoPersonalWs, doc.id);
    expect(bytes).toBeNull();
  });
});
