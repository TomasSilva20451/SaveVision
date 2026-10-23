import { describe, expect, it } from "vitest";
import { flashMatchesPath, type FlashMessage } from "@/lib/ui/flash";

describe("flashMatchesPath", () => {
  const budgetFlash: FlashMessage = {
    type: "success",
    text: "Limite de orçamento guardado.",
    targetPath: "/orcamentos",
  };

  it("mostra a mensagem apenas na página que a criou", () => {
    expect(flashMatchesPath(budgetFlash, "/orcamentos")).toBe(true);
    expect(flashMatchesPath(budgetFlash, "/despesas-recorrentes")).toBe(false);
  });

  it("mantém compatibilidade com mensagens antigas sem âmbito", () => {
    expect(flashMatchesPath({ type: "info", text: "Mensagem" }, "/dashboard")).toBe(true);
  });
});
