import { describe, expect, it } from "vitest";

import { assessMlDrift } from "@/lib/ml/drift";

describe("deteção de drift ML", () => {
  it("não conclui drift com amostras insuficientes", () => {
    expect(assessMlDrift(
      { sampleCount: 5, coverage: 1, meanConfidence: 0.9, correctionRate: 0 },
      { sampleCount: 40, coverage: 1, meanConfidence: 0.9, correctionRate: 0 },
    ).status).toBe("INSUFFICIENT_DATA");
  });

  it("sinaliza degradação material", () => {
    expect(assessMlDrift(
      { sampleCount: 40, coverage: 0.5, meanConfidence: 0.6, correctionRate: 0.3 },
      { sampleCount: 40, coverage: 0.95, meanConfidence: 0.9, correctionRate: 0.05 },
    ).status).toBe("DRIFT");
  });
});
