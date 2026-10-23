import { describe, expect, it } from "vitest";
import {
  paymentAccountLabel,
  preferredPaymentAccountId,
  sortPaymentAccounts,
} from "@/lib/finance/payment-account";

const accounts = [
  { id: "savings", name: "Conta Poupança", type: "SAVINGS" },
  { id: "current", name: "Conta Principal", type: "CURRENT" },
  { id: "cash", name: "Dinheiro", type: "CASH" },
];

describe("seleção de conta para pagamentos", () => {
  it("prefere uma conta à ordem à poupança", () => {
    expect(preferredPaymentAccountId(accounts)).toBe("current");
    expect(sortPaymentAccounts(accounts).map((account) => account.id)).toEqual([
      "current",
      "cash",
      "savings",
    ]);
  });

  it("respeita uma conta explicitamente configurada", () => {
    expect(preferredPaymentAccountId(accounts, "savings")).toBe("savings");
  });

  it("assinala contas de poupança no seletor", () => {
    expect(paymentAccountLabel(accounts[0]!)).toContain("evitar para pagamentos");
  });
});
