import { describe, expect, it } from "vitest";
import {
  buildTreasuryProjection,
  exampleTreasuryScenario,
  sumStartingBalance,
  treasuryHorizonEnd,
} from "@/lib/finance/treasury-forecast";
import { calculateAccountBalance } from "@/lib/finance/aggregates";
import { startOfCivilDay } from "@/lib/datetime/civil-date";
import type { TreasuryForecastEvent } from "@/lib/finance/treasury-forecast";

function outflow(
  partial: Pick<TreasuryForecastEvent, "id" | "label" | "dueDate" | "amount"> &
    Partial<TreasuryForecastEvent>,
): TreasuryForecastEvent {
  return {
    direction: "outflow",
    source: "RECURRING_EXPENSE",
    sourceRef: partial.id,
    movementKind: "PREVISTO",
    ...partial,
  };
}

function inflow(
  partial: Pick<TreasuryForecastEvent, "id" | "label" | "dueDate" | "amount"> &
    Partial<TreasuryForecastEvent>,
): TreasuryForecastEvent {
  return {
    direction: "inflow",
    source: "INCOME_EXPECTED",
    sourceRef: partial.id,
    movementKind: "PREVISTO",
    ...partial,
  };
}

describe("treasury-forecast", () => {
  it("exemplo 1500 + 500 - 45 - 70 = 1885", () => {
    const result = exampleTreasuryScenario();
    expect(result.startingBalance).toBe("1500.00");
    expect(result.expectedInflows).toBe("500.00");
    expect(result.expectedOutflows).toBe("115.00");
    expect(result.projectedBalance).toBe("1885.00");
    expect(result.eventSteps.at(-1)?.balanceAfter).toBe("1885.00");
  });

  it("subtrai saídas previstas no horizonte (PAID filtradas na camada de dados)", () => {
    const asOf = startOfCivilDay({ year: 2026, month: 10, day: 16 });
    const result = buildTreasuryProjection({
      startingBalance: "1000",
      horizonDays: 30,
      asOf,
      events: [
        outflow({
          id: "expected",
          label: "Despesa prevista",
          dueDate: new Date(asOf.getTime() + 2 * 86_400_000),
          amount: "200",
        }),
      ],
    });
    expect(result.projectedBalance).toBe("800.00");
  });

  it("inclui receita EXPECTED e adiamento (POSTPONED) quando presentes nos eventos", () => {
    const asOf = startOfCivilDay({ year: 2026, month: 10, day: 16 });
    const result = buildTreasuryProjection({
      startingBalance: "1500",
      horizonDays: 30,
      asOf,
      events: [
        inflow({
          id: "inc",
          label: "Salário",
          dueDate: new Date(asOf.getTime() + 3 * 86_400_000),
          amount: "500",
        }),
        outflow({
          id: "post",
          label: "Renda adiada",
          dueDate: new Date(asOf.getTime() + 5 * 86_400_000),
          amount: "70",
        }),
      ],
    });
    expect(result.projectedBalance).toBe("1930.00");
  });

  it("horizonEnd civil via treasuryHorizonEnd", () => {
    const asOf = startOfCivilDay({ year: 2026, month: 1, day: 31 });
    const end = treasuryHorizonEnd(asOf, 7);
    expect(end.getTime()).toBeGreaterThan(asOf.getTime());
  });

  it("transferência interna: saldo agregado não conta o mesmo euro duas vezes", () => {
    const movements = [
      {
        accountId: "a1",
        type: "TRANSFER" as const,
        status: "COMPLETED" as const,
        amount: "-100",
      },
      {
        accountId: "a2",
        type: "TRANSFER" as const,
        status: "COMPLETED" as const,
        amount: "100",
      },
    ];
    const b1 = calculateAccountBalance("1000", movements, "a1");
    const b2 = calculateAccountBalance("500", movements, "a2");
    expect(sumStartingBalance([b1.toFixed(2), b2.toFixed(2)])).toBe("1500.00");
  });

  it("ignora eventos fora do horizonte", () => {
    const asOf = startOfCivilDay({ year: 2026, month: 10, day: 16 });
    const result = buildTreasuryProjection({
      startingBalance: "1000",
      horizonDays: 7,
      asOf,
      events: [
        outflow({
          id: "far",
          label: "Longe",
          dueDate: new Date(asOf.getTime() + 20 * 86_400_000),
          amount: "100",
        }),
      ],
    });
    expect(result.projectedBalance).toBe("1000.00");
    expect(result.events).toHaveLength(0);
  });

  it("sumStartingBalance", () => {
    expect(sumStartingBalance(["1500", "0.50"])).toBe("1500.50");
  });
});
