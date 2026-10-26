import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    mlEvaluationRun: {
      findFirst: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import { isProbabilisticForecastReleaseAllowed } from "@/lib/ml/release-eval-gate";

describe("isProbabilisticForecastReleaseAllowed", () => {
  it("permite em e2e", async () => {
    vi.stubEnv("FINTWIN_ENV", "e2e");
    await expect(isProbabilisticForecastReleaseAllowed()).resolves.toEqual({ allowed: true });
  });

  it("bloqueia staging sem eval", async () => {
    vi.stubEnv("FINTWIN_ENV", "staging");
    vi.mocked(db.mlEvaluationRun.findFirst).mockResolvedValue(null);
    const result = await isProbabilisticForecastReleaseAllowed();
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("NO_PASSED_EVAL");
  });
});
