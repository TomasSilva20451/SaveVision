import { describe, expect, it } from "vitest";
import { HELP_CORPUS } from "@/lib/help/help-corpus";
import { searchHelpCorpus, setHelpCorpusForTests } from "@/lib/help/help-search";

describe("searchHelpCorpus", () => {
  it("prioriza chunks da rota actual", () => {
    setHelpCorpusForTests(HELP_CORPUS);
    const hits = searchHelpCorpus("anular pagamento recorrente", {
      pathname: "/despesas-recorrentes",
      limit: 3,
    });
    expect(hits[0]?.chunk.id).toBe("recurring-void-payment");
  });

  it("encontra diferença previsão simulação", () => {
    setHelpCorpusForTests(HELP_CORPUS);
    const hits = searchHelpCorpus("diferença previsão simulação", { limit: 2 });
    expect(hits.some((hit) => hit.chunk.id === "forecast-vs-simulation")).toBe(true);
  });
});
