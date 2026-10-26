import { describe, expect, it } from "vitest";
import { assertPrivateBucket, objectKey } from "@/lib/platform/object-storage";

describe("armazenamento privado", () => {
  it("isola a chave por ambiente e workspace", () => {
    const key = "ab".repeat(24);
    expect(objectKey("staging", "ws_1", key)).toBe(`staging/ws_1/${key}`);
  });

  it("recusa um bucket de produção em staging", () => {
    expect(() => assertPrivateBucket("fintwin-production-docs", "staging")).toThrow(/staging/);
    expect(assertPrivateBucket("fintwin-staging-docs", "staging")).toBe("fintwin-staging-docs");
  });
});
