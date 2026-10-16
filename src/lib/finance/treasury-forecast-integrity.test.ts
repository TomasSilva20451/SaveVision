import { describe, expect, it } from "vitest";
import { startOfCivilDay } from "@/lib/datetime/civil-date";
import { buildTreasuryProjection } from "@/lib/finance/treasury-forecast";
import { liabilityIdsSuppressedByRecurring } from "@/lib/finance/treasury-forecast-integrity";

describe("treasury-forecast-integrity", () => {
  it("suprime passivo ligado a recorrência activa", () => {
    const suppressed = liabilityIdsSuppressedByRecurring([
      { linkedLiabilityId: "loan-1", status: "ACTIVE" },
      { linkedLiabilityId: null, status: "ACTIVE" },
    ]);
    expect(suppressed.has("loan-1")).toBe(true);
  });

  it("600 € recorrência + passivo ligado não soma 1200 €", () => {
    const asOf = startOfCivilDay({ year: 2026, month: 10, day: 1 });
    const due = new Date(asOf.getTime() + 10 * 86_400_000);
    const result = buildTreasuryProjection({
      startingBalance: "2000",
      horizonDays: 30,
      asOf,
      events: [
        {
          id: "rec-occ-1",
          label: "Prestação da casa",
          dueDate: due,
          amount: "600",
          direction: "outflow",
          source: "RECURRING_EXPENSE",
          sourceRef: "rec-1",
          movementKind: "PREVISTO",
        },
      ],
    });
    expect(result.expectedOutflows).toBe("600.00");
    expect(result.projectedBalance).toBe("1400.00");
  });
});
