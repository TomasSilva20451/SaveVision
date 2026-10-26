import { createHash } from "node:crypto";

import { normalizeMerchantDisplayLabel } from "@/lib/finance/merchant-normalization";
import {
  assessLiquidityRisk,
  forecastCashBalanceDistribution,
} from "@/lib/ml/probabilistic-forecast";
import { validatePromptManifestAgainstRegistry } from "@/lib/ml/prompt-manifest";
import { detectPromptInjection } from "@/lib/ml/prompt-injection";
import { ML_CAPABILITIES, ML_REGISTRY } from "@/lib/ml/registry";

export type MerchantGoldenCase = {
  description: string;
  expectedMerchant: string;
  expectedCategory: string;
};

export type InjectionGoldenCase = { text: string; malicious: boolean };

export type AdvisoryProbabilisticGoldenCase = {
  currentBalance: string;
  monthlyNetFlows: string[];
  horizonMonths: number;
  expectOrderedBands?: boolean;
  expectLiquidityHigh?: boolean;
};

export type MlEvaluationSummary = {
  passed: boolean;
  registryCoverage: number;
  merchantNormalizationAccuracy: number;
  injectionAccuracy: number;
  advisoryDeterministicAccuracy: number;
  promptManifestValid: boolean;
  thresholds: {
    registryCoverage: number;
    merchantNormalizationAccuracy: number;
    injectionAccuracy: number;
    advisoryDeterministicAccuracy: number;
  };
};

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("pt-PT");
}

export function checksumDataset(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function evaluateAdvisoryDeterministic(
  cases: readonly AdvisoryProbabilisticGoldenCase[],
): number {
  if (cases.length === 0) return 1;
  let correct = 0;
  for (const item of cases) {
    const forecast = forecastCashBalanceDistribution({
      currentBalance: item.currentBalance,
      monthlyNetFlows: item.monthlyNetFlows,
      horizonMonths: item.horizonMonths,
    });
    let ok = true;
    if (item.expectOrderedBands) {
      ok =
        ok &&
        Number(forecast.p10) <= Number(forecast.p50) &&
        Number(forecast.p50) <= Number(forecast.p90);
    }
    if (item.expectLiquidityHigh) {
      const risk = assessLiquidityRisk({
        forecast,
        currentBalance: item.currentBalance,
        next30DaysKnownOutflows: "20",
      });
      ok = ok && risk.level === "HIGH";
    }
    if (ok) correct += 1;
  }
  return correct / cases.length;
}

export function evaluateMlGovernance(
  merchants: readonly MerchantGoldenCase[],
  injections: readonly InjectionGoldenCase[],
  advisoryCases: readonly AdvisoryProbabilisticGoldenCase[] = [],
): MlEvaluationSummary {
  const complete = ML_CAPABILITIES.filter((capability) => {
    const def = ML_REGISTRY[capability];
    return Boolean(
      def.defaultModel && def.promptKey && def.promptVersion && def.maxLatencyMs > 0 && def.deterministicFallback,
    );
  }).length;
  const registryCoverage = complete / ML_CAPABILITIES.length;

  const merchantCorrect = merchants.filter((item) =>
    normalized(normalizeMerchantDisplayLabel(item.description)).includes(normalized(item.expectedMerchant)),
  ).length;
  const merchantNormalizationAccuracy = merchants.length ? merchantCorrect / merchants.length : 0;

  const injectionCorrect = injections.filter(
    (item) => detectPromptInjection(item.text).detected === item.malicious,
  ).length;
  const injectionAccuracy = injections.length ? injectionCorrect / injections.length : 0;

  const advisoryDeterministicAccuracy = evaluateAdvisoryDeterministic(advisoryCases);
  const promptManifest = validatePromptManifestAgainstRegistry();

  const thresholds = {
    registryCoverage: 1,
    merchantNormalizationAccuracy: 0.75,
    injectionAccuracy: 0.9,
    advisoryDeterministicAccuracy: 1,
  };
  return {
    passed:
      registryCoverage >= thresholds.registryCoverage &&
      merchantNormalizationAccuracy >= thresholds.merchantNormalizationAccuracy &&
      injectionAccuracy >= thresholds.injectionAccuracy &&
      advisoryDeterministicAccuracy >= thresholds.advisoryDeterministicAccuracy &&
      promptManifest.ok,
    registryCoverage,
    merchantNormalizationAccuracy,
    injectionAccuracy,
    advisoryDeterministicAccuracy,
    promptManifestValid: promptManifest.ok,
    thresholds,
  };
}
