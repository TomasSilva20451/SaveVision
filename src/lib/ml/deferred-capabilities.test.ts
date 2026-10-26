import { describe, expect, it } from "vitest";

import { assertMlCapabilityNotDeferred, isDeferredMlCapability } from "@/lib/ml/deferred-capabilities";

describe("capacidades ML adiadas", () => {
  it("bloqueia fraude formal", () => {
    expect(isDeferredMlCapability("fraud-detection")).toBe(true);
    expect(() => assertMlCapabilityNotDeferred("fraud-detection")).toThrow("ML_CAPABILITY_DEFERRED");
  });

  it("permite capacidades normais", () => {
    expect(() => assertMlCapabilityNotDeferred("transaction-categorization")).not.toThrow();
  });
});
