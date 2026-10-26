import advisoryCases from "../../../ml/golden/advisory-probabilistic.pt-PT.json";
import merchantCases from "../../../ml/golden/transaction-categorization.pt-PT.json";
import injectionCases from "../../../ml/red-team/prompt-injection.pt-PT.json";
import { describe, expect, it } from "vitest";

import { evaluateMlGovernance } from "@/lib/ml/evaluation";
import { detectPromptInjection } from "@/lib/ml/prompt-injection";
import { ML_CAPABILITIES, ML_REGISTRY } from "@/lib/ml/registry";

describe("governação ML", () => {
  it("mantém todas as capacidades no registo versionado", () => {
    expect(Object.keys(ML_REGISTRY).sort()).toEqual([...ML_CAPABILITIES].sort());
    for (const capability of ML_CAPABILITIES) {
      expect(ML_REGISTRY[capability].promptVersion).toMatch(/^\d+\.\d+\.\d+$/);
      expect(ML_REGISTRY[capability].deterministicFallback.length).toBeGreaterThan(10);
    }
  });

  it("passa os limiares do golden dataset e red-team", () => {
    expect(evaluateMlGovernance(merchantCases, injectionCases, advisoryCases).passed).toBe(true);
  });

  it("não confunde uma descrição bancária normal com instruções", () => {
    expect(detectPromptInjection("PAGAMENTO CONTINENTE MODELO 0182").detected).toBe(false);
  });
});
