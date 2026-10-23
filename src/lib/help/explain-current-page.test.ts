import { describe, expect, it } from "vitest";
import { explainCurrentPageDeterministic } from "@/lib/help/explain-current-page";

describe("explainCurrentPageDeterministic", () => {
  it("devolve texto para rotas conhecidas", () => {
    const result = explainCurrentPageDeterministic("/transacoes");
    expect(result.answer.length).toBeGreaterThan(20);
    expect(result.chunkIds.length).toBeGreaterThan(0);
  });
});
