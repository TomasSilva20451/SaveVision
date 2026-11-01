import { describe, expect, it } from "vitest";
import { readReturnTo } from "@/lib/ui/form-return";

describe("readReturnTo", () => {
  it("aceita caminhos internos", () => {
    const fd = new FormData();
    fd.set("_returnTo", "/transacoes");
    expect(readReturnTo(fd)).toBe("/transacoes");
  });

  it("rejeita URLs externas e caminhos inválidos", () => {
    expect(readReturnTo(new FormData())).toBeNull();
    const fd = new FormData();
    fd.set("_returnTo", "https://evil.example");
    expect(readReturnTo(fd)).toBeNull();
    fd.set("_returnTo", "//evil.example");
    expect(readReturnTo(fd)).toBeNull();
  });
});
