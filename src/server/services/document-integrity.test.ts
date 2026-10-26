import { describe, expect, it } from "vitest";
import { classifyReadError } from "@/server/services/document-integrity-errors";

describe("classifyReadError", () => {
  it("deteta ficheiro em falta", () => {
    expect(classifyReadError(Object.assign(new Error("ENOENT"), { code: "ENOENT" }))).toBe("MISSING");
    expect(classifyReadError(new Error("OBJECT_STORAGE_404"))).toBe("MISSING");
  });

  it("deteta falha de descifra", () => {
    expect(classifyReadError(new Error("decrypt auth tag"))).toBe("DECRYPT_FAIL");
  });
});
