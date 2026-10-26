import fs from "node:fs";
import path from "node:path";

import {
  checksumDataset,
  evaluateMlGovernance,
  type AdvisoryProbabilisticGoldenCase,
  type InjectionGoldenCase,
  type MerchantGoldenCase,
} from "../src/lib/ml/evaluation";
import { validatePromptManifestAgainstRegistry } from "../src/lib/ml/prompt-manifest";

async function main() {
  const root = process.cwd();
  const merchantPath = path.join(root, "ml/golden/transaction-categorization.pt-PT.json");
  const injectionPath = path.join(root, "ml/red-team/prompt-injection.pt-PT.json");
  const advisoryPath = path.join(root, "ml/golden/advisory-probabilistic.pt-PT.json");

  const merchants = JSON.parse(fs.readFileSync(merchantPath, "utf8")) as MerchantGoldenCase[];
  const injections = JSON.parse(fs.readFileSync(injectionPath, "utf8")) as InjectionGoldenCase[];
  const advisory = JSON.parse(fs.readFileSync(advisoryPath, "utf8")) as AdvisoryProbabilisticGoldenCase[];
  const result = evaluateMlGovernance(merchants, injections, advisory);
  const manifest = validatePromptManifestAgainstRegistry();

  const output = {
    suiteVersion: "1.1.0",
    releaseRef: process.env.GITHUB_SHA ?? process.env.RELEASE_REF ?? "local",
    ...result,
    promptManifest: manifest,
    datasetChecksums: {
      transactionCategorizationPtPt: checksumDataset(merchants),
      promptInjectionPtPt: checksumDataset(injections),
      advisoryProbabilisticPtPt: checksumDataset(advisory),
    },
  };

  if (process.env.FINTWIN_ML_EVAL_PERSIST === "1") {
    const { db } = await import("../src/lib/db");
    try {
      await db.mlEvaluationRun.create({
        data: {
          suiteVersion: output.suiteVersion,
          releaseRef: output.releaseRef,
          status: result.passed ? "PASSED" : "FAILED",
          metrics: {
            registryCoverage: result.registryCoverage,
            merchantNormalizationAccuracy: result.merchantNormalizationAccuracy,
            injectionAccuracy: result.injectionAccuracy,
            advisoryDeterministicAccuracy: result.advisoryDeterministicAccuracy,
            promptManifestValid: result.promptManifestValid,
            thresholds: result.thresholds,
          },
          datasetChecksums: output.datasetChecksums,
          finishedAt: new Date(),
        },
      });
    } finally {
      await db.$disconnect();
    }
  }

  console.log(JSON.stringify(output, null, 2));
  if (!result.passed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
