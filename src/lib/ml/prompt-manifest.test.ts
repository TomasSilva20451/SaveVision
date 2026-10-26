import { describe, expect, it } from "vitest";

import { validatePromptManifestAgainstRegistry } from "@/lib/ml/prompt-manifest";

describe("manifest de prompts", () => {
  it("alinha com ML_REGISTRY", () => {
    const result = validatePromptManifestAgainstRegistry();
    expect(result.ok, result.errors.join(", ")).toBe(true);
  });
});
