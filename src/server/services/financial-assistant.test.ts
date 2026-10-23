import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/workspace-access", () => ({ requireWorkspaceAccess: vi.fn() }));
vi.mock("@/lib/finance/financial-assistant-format", () => ({
  formatAssistantAnswer: vi.fn(),
}));
vi.mock("@/server/services/financial-assistant-tools", () => ({
  runAssistantTool: vi.fn(),
}));
vi.mock("@/server/services/local-ai-settings", () => ({
  getLocalAiSettings: vi.fn().mockResolvedValue({
    globalEnabled: true,
    localAiEnabled: true,
    ollamaBaseUrl: "http://127.0.0.1:11434",
    textModel: "mock",
    imageModel: "mock",
    helpModel: "mock",
    storePrompts: true,
  }),
  isLocalAiActive: vi.fn().mockReturnValue(true),
}));

import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import type { FinancialAssistantProvider } from "@/server/providers/contracts";
import { askFinancialAssistant } from "@/server/services/financial-assistant";
import { formatAssistantAnswer } from "@/lib/finance/financial-assistant-format";
import { runAssistantTool } from "@/server/services/financial-assistant-tools";

describe("askFinancialAssistant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireWorkspaceAccess).mockResolvedValue({ role: "OWNER" } as never);
  });

  it("pede clarificação quando a confiança é baixa", async () => {
    const provider: FinancialAssistantProvider = {
      name: "mock",
      parseIntent: vi.fn().mockResolvedValue({
        intent: "savings_rate",
        parameters: {},
        confidence: 0.3,
        clarification: "De que mês falas?",
      }),
    };

    const result = await askFinancialAssistant("u1", "ws1", "Como poupo?", provider);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.answer).toContain("De que mês");
      expect(runAssistantTool).not.toHaveBeenCalled();
    }
  });

  it("executa ferramenta após intent válido", async () => {
    const provider: FinancialAssistantProvider = {
      name: "mock",
      parseIntent: vi.fn().mockResolvedValue({
        intent: "highest_balance_account",
        parameters: {},
        confidence: 0.92,
        clarification: null,
      }),
    };
    vi.mocked(runAssistantTool).mockResolvedValue({
      summaryKey: "highest_balance_account",
      facts: { accountName: "CGD", accountId: "a1", balance: "1200.00" },
      evidence: ["Conta com maior saldo: «CGD» (1 200,00 €)."],
      links: [{ label: "Contas", href: "/contas" }],
    });
    vi.mocked(formatAssistantAnswer).mockReturnValue("A conta «CGD» tem o saldo mais alto.");

    const result = await askFinancialAssistant("u1", "ws1", "Qual a conta com mais saldo?", provider);
    expect(result.ok).toBe(true);
    expect(runAssistantTool).toHaveBeenCalledWith(
      "u1",
      "ws1",
      expect.objectContaining({ intent: "highest_balance_account" }),
    );
  });
});
