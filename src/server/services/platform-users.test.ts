import { describe, expect, it } from "vitest";
import { createPlatformUserSchema } from "@/lib/platform/platform-user-schema";

describe("createPlatformUserSchema", () => {
  it("normaliza email e exige password longa", () => {
    const parsed = createPlatformUserSchema.safeParse({
      name: "Ana",
      email: "Ana@Example.COM",
      password: "short",
    });
    expect(parsed.success).toBe(false);

    const ok = createPlatformUserSchema.safeParse({
      name: "Ana",
      email: "Ana@Example.COM",
      password: "valid-password-14",
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.email).toBe("ana@example.com");
  });
});
