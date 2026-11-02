import { describe, expect, it } from "vitest";
import { isCivilDateBefore } from "@/lib/finance/recurring-prior-settlement";

describe("isCivilDateBefore", () => {
  const today = { year: 2026, month: 11, day: 2 };

  it("trata meses anteriores como já decorridos", () => {
    expect(isCivilDateBefore({ year: 2026, month: 10, day: 4 }, today)).toBe(true);
  });

  it("mantém o vencimento de hoje e o seguinte em aberto", () => {
    expect(isCivilDateBefore({ year: 2026, month: 11, day: 2 }, today)).toBe(false);
    expect(isCivilDateBefore({ year: 2026, month: 11, day: 4 }, today)).toBe(false);
  });
});