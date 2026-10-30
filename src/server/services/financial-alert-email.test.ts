import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const send = vi.fn();
const findManyAlerts = vi.fn();
const findManyMembers = vi.fn();
const findState = vi.fn();
const upsertState = vi.fn();

vi.mock("@/server/providers/email/registry", () => ({
  resolveEmailDeliveryProvider: () => ({
    name: "mock",
    isConfigured: () => true,
    send,
  }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    financialAlert: { findMany: (...args: unknown[]) => findManyAlerts(...args) },
    workspaceMember: { findMany: (...args: unknown[]) => findManyMembers(...args) },
    financialAlertUserState: {
      findUnique: (...args: unknown[]) => findState(...args),
      upsert: (...args: unknown[]) => upsertState(...args),
    },
  },
}));

describe("notifyFinancialAlertEmails", () => {
  beforeEach(() => {
    send.mockReset();
    findManyAlerts.mockReset();
    findManyMembers.mockReset();
    findState.mockReset();
    upsertState.mockReset();
    vi.stubEnv("SMTP_HOST", "smtp.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("envia uma vez e regista emailNotifiedAt", async () => {
    findManyAlerts.mockResolvedValue([
      {
        id: "alert-1",
        type: "NEGATIVE_PROJECTED_BALANCE",
        severity: "CRITICAL",
        title: "Saldo negativo",
        description: "Projeção",
        actionUrl: "/alertas",
      },
    ]);
    findManyMembers.mockResolvedValue([
      { user: { id: "u1", email: "a@test.local", emailVerifiedAt: new Date() } },
    ]);
    findState.mockResolvedValue(null);
    upsertState.mockResolvedValue({});

    const { notifyFinancialAlertEmails } = await import("@/server/services/financial-alert-email");
    const sent = await notifyFinancialAlertEmails("ws-1");
    expect(sent).toBe(1);
    expect(send).toHaveBeenCalledOnce();
    expect(upsertState).toHaveBeenCalledOnce();
  });

  it("não reenvia se emailNotifiedAt existe", async () => {
    findManyAlerts.mockResolvedValue([
      {
        id: "alert-1",
        type: "SAVINGS_PLAN_CONTRIBUTION_MISSED",
        severity: "HIGH",
        title: "Falta",
        description: "Semana",
        actionUrl: null,
      },
    ]);
    findManyMembers.mockResolvedValue([
      { user: { id: "u1", email: "a@test.local", emailVerifiedAt: new Date() } },
    ]);
    findState.mockResolvedValue({ emailNotifiedAt: new Date() });

    const { notifyFinancialAlertEmails } = await import("@/server/services/financial-alert-email");
    const sent = await notifyFinancialAlertEmails("ws-1");
    expect(sent).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });
});
