import { describe, expect, it } from "vitest";
import { canBackoffice } from "@/lib/platform/backoffice-policy";

describe("backoffice least privilege", () => {
  it("nega o backoffice a utilizadores normais", () => {
    expect(canBackoffice("USER", "open")).toBe(false);
    expect(canBackoffice("USER", "list-jobs")).toBe(false);
  });

  it("deixa o suporte ver a fila sem a repor nem ler finanças", () => {
    expect(canBackoffice("SUPPORT", "open")).toBe(true);
    expect(canBackoffice("SUPPORT", "list-jobs")).toBe(true);
    expect(canBackoffice("SUPPORT", "retry-jobs")).toBe(false);
    expect(canBackoffice("SUPPORT", "read-financial-records")).toBe(false);
    expect(canBackoffice("SUPPORT", "read-document-bytes")).toBe(false);
  });

  it("reserva a reposição de jobs ao administrador", () => {
    expect(canBackoffice("ADMIN", "retry-jobs")).toBe(true);
    expect(canBackoffice("ADMIN", "read-document-bytes")).toBe(false);
  });
});
