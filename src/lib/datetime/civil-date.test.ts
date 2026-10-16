import { describe, expect, it } from "vitest";
import {
  civilDateIsoToInstant,
  civilDateFromInstant,
  formatCivilDateIso,
  isInstantInCivilMonth,
  startOfCivilMonth,
} from "@/lib/datetime/civil-date";

describe("datas civis em Europe/Lisbon", () => {
  it("trata o fim de junho em UTC como 1 de julho em Lisboa", () => {
    const civil = civilDateFromInstant(new Date("2026-06-30T23:30:00.000Z"));

    expect(formatCivilDateIso(civil)).toBe("2026-07-01");
  });

  it("mantém 31 de janeiro no inverno, quando Lisboa coincide com UTC", () => {
    const civil = civilDateFromInstant(new Date("2026-01-31T23:30:00.000Z"));

    expect(formatCivilDateIso(civil)).toBe("2026-01-31");
  });

  it("parse YYYY-MM-DD como civil Lisbon, não UTC", () => {
    const instant = civilDateIsoToInstant("2026-03-15");
    expect(formatCivilDateIso(civilDateFromInstant(instant))).toBe("2026-03-15");
  });

  it("coloca 31 de março às 23:30 UTC em abril, depois da hora de verão", () => {
    const instant = new Date("2026-03-31T23:30:00.000Z");

    expect(formatCivilDateIso(civilDateFromInstant(instant))).toBe("2026-04-01");
    expect(isInstantInCivilMonth(instant, 2026, 3)).toBe(false);
    expect(isInstantInCivilMonth(instant, 2026, 4)).toBe(true);
  });

  it("calcula o início dos meses civis nos dois lados da mudança de hora", () => {
    expect(startOfCivilMonth(2026, 3).toISOString()).toBe(
      "2026-03-01T00:00:00.000Z",
    );
    expect(startOfCivilMonth(2026, 4).toISOString()).toBe(
      "2026-03-31T23:00:00.000Z",
    );
    expect(startOfCivilMonth(2026, 10).toISOString()).toBe(
      "2026-09-30T23:00:00.000Z",
    );
    expect(startOfCivilMonth(2026, 11).toISOString()).toBe(
      "2026-11-01T00:00:00.000Z",
    );
  });

  it("mantém 29 de março e 25 de outubro na data civil correta durante as transições", () => {
    expect(
      formatCivilDateIso(
        civilDateFromInstant(new Date("2026-03-29T00:30:00.000Z")),
      ),
    ).toBe("2026-03-29");
    expect(
      formatCivilDateIso(
        civilDateFromInstant(new Date("2026-03-29T01:30:00.000Z")),
      ),
    ).toBe("2026-03-29");
    expect(
      formatCivilDateIso(
        civilDateFromInstant(new Date("2026-10-25T00:30:00.000Z")),
      ),
    ).toBe("2026-10-25");
    expect(
      formatCivilDateIso(
        civilDateFromInstant(new Date("2026-10-25T01:30:00.000Z")),
      ),
    ).toBe("2026-10-25");
  });
});
