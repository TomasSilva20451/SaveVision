import "server-only";

import { createHash } from "node:crypto";

import { db } from "@/lib/db";
import { detectPromptInjection } from "@/lib/ml/prompt-injection";
import { ML_REGISTRY, type MlCapability } from "@/lib/ml/registry";
import { assessMlDrift } from "@/lib/ml/drift";
import { getLocalAiSettings, isLocalAiActive } from "@/server/services/local-ai-settings";
import { hasAcceptedConsent } from "@/server/services/privacy-consent";

const PROMPT_RETENTION_DAYS = 7;

export type GovernedMlContext = {
  capability: MlCapability;
  userId: string;
  workspaceId?: string | null;
  model: string;
  input: unknown;
  promptText?: string;
};

export type GovernedMlResult<T> =
  | { source: "MODEL"; value: T; latencyMs: number }
  | { source: "FALLBACK"; value: T; latencyMs: number; reason: string };

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function estimateTokens(value: unknown): number {
  return Math.ceil(JSON.stringify(value).length / 4);
}

function envKillSwitchIncludes(capability: MlCapability): boolean {
  const entries = (process.env.FINTWIN_ML_KILL_SWITCH ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return entries.includes("all") || entries.includes(capability);
}

async function capabilityAvailable(capability: MlCapability): Promise<{ available: boolean; reason?: string }> {
  if (envKillSwitchIncludes(capability)) return { available: false, reason: "GLOBAL_KILL_SWITCH" };
  try {
    const control = await db.mlFeatureControl.findUnique({ where: { capability } });
    if (control?.killSwitch) return { available: false, reason: "CAPABILITY_KILL_SWITCH" };
    if (control && !control.enabled) return { available: false, reason: "CAPABILITY_DISABLED" };
  } catch {
    // Durante uma migração parcial, a ausência da tabela não deve quebrar o produto:
    // a execução ML é recusada e o fallback determinístico assume o fluxo.
    return { available: false, reason: "GOVERNANCE_STORE_UNAVAILABLE" };
  }
  return { available: true };
}

async function recordInvocation(input: {
  context: GovernedMlContext;
  outcome: "SUCCESS" | "FALLBACK" | "BLOCKED" | "ERROR";
  latencyMs: number;
  output?: unknown;
  confidence?: number;
  fallbackReason?: string;
  promptExcerpt?: string | null;
}) {
  const definition = ML_REGISTRY[input.context.capability];
  try {
    await db.mlInvocationEvent.create({
      data: {
        workspaceId: input.context.workspaceId ?? null,
        userId: input.context.userId,
        capability: input.context.capability,
        modelKey: input.context.model,
        modelVersion: definition.modelVersion,
        promptKey: definition.promptKey,
        promptVersion: definition.promptVersion,
        outcome: input.outcome,
        latencyMs: input.latencyMs,
        estimatedInputTokens: estimateTokens(input.context.input),
        estimatedOutputTokens: input.output === undefined ? 0 : estimateTokens(input.output),
        confidence: input.confidence,
        inputHash: hash(input.context.input),
        outputHash: input.output === undefined ? null : hash(input.output),
        promptExcerpt: input.promptExcerpt,
        promptExpiresAt: input.promptExcerpt
          ? new Date(Date.now() + PROMPT_RETENTION_DAYS * 86_400_000)
          : null,
        fallbackReason: input.fallbackReason,
        humanReviewRequired: definition.humanReviewRequired,
      },
    });
  } catch {
    // Telemetria nunca pode transformar uma sugestão opcional numa falha financeira.
  }
}

export async function runGovernedMl<T>(
  context: GovernedMlContext,
  execute: () => Promise<T>,
  fallback: (reason: string) => Promise<T> | T,
  confidence?: (output: T) => number | undefined,
): Promise<GovernedMlResult<T>> {
  const started = Date.now();
  const definition = ML_REGISTRY[context.capability];
  const settings = await getLocalAiSettings(context.userId);
  const feature = await capabilityAvailable(context.capability);
  const injection = detectPromptInjection(context.promptText ?? JSON.stringify(context.input));

  let blockedReason: string | null = null;
  if (!isLocalAiActive(settings)) blockedReason = "LOCAL_AI_DISABLED";
  else if (!feature.available) blockedReason = feature.reason ?? "CAPABILITY_DISABLED";
  else if (estimateTokens(context.input) > definition.maxInputTokens) blockedReason = "INPUT_LIMIT";
  else if (injection.detected) blockedReason = "PROMPT_INJECTION_SIGNAL";

  const canRetainPrompt =
    settings.storePrompts && (await hasAcceptedConsent(context.userId, "prompt_storage"));
  const promptExcerpt = canRetainPrompt ? (context.promptText ?? "").slice(0, 2_000) : null;

  if (blockedReason) {
    const value = await fallback(blockedReason);
    const latencyMs = Date.now() - started;
    await recordInvocation({
      context,
      outcome: "BLOCKED",
      latencyMs,
      output: value,
      fallbackReason: blockedReason,
      promptExcerpt,
    });
    return { source: "FALLBACK", value, latencyMs, reason: blockedReason };
  }

  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("ML_LATENCY_LIMIT")), definition.maxLatencyMs);
    });
    const value = await Promise.race([execute(), timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    });
    const latencyMs = Date.now() - started;
    await recordInvocation({
      context,
      outcome: "SUCCESS",
      latencyMs,
      output: value,
      confidence: confidence?.(value),
      promptExcerpt,
    });
    return { source: "MODEL", value, latencyMs };
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 160) : "MODEL_ERROR";
    const value = await fallback(reason);
    const latencyMs = Date.now() - started;
    await recordInvocation({
      context,
      outcome: "FALLBACK",
      latencyMs,
      output: value,
      fallbackReason: reason,
      promptExcerpt,
    });
    return { source: "FALLBACK", value, latencyMs, reason };
  }
}

export async function purgeExpiredMlPrompts(): Promise<number> {
  const result = await db.mlInvocationEvent.updateMany({
    where: { promptExpiresAt: { lte: new Date() }, promptExcerpt: { not: null } },
    data: { promptExcerpt: null, promptExpiresAt: null },
  });
  return result.count;
}

export async function setMlFeatureControl(input: {
  capability: MlCapability;
  enabled: boolean;
  killSwitch: boolean;
  reason?: string | null;
  updatedById: string;
}) {
  return db.mlFeatureControl.upsert({
    where: { capability: input.capability },
    create: input,
    update: {
      enabled: input.enabled,
      killSwitch: input.killSwitch,
      reason: input.reason ?? null,
      updatedById: input.updatedById,
    },
  });
}

export async function getMlGovernanceOverview() {
  const now = Date.now();
  const currentStart = new Date(now - 30 * 86_400_000);
  const baselineStart = new Date(now - 60 * 86_400_000);
  const [controls, recent, baselineEvents, latestEvaluation] = await Promise.all([
    db.mlFeatureControl.findMany({ orderBy: { capability: "asc" } }),
    db.mlInvocationEvent.findMany({
      where: { createdAt: { gte: currentStart } },
      orderBy: { createdAt: "desc" },
      take: 2_000,
    }),
    db.mlInvocationEvent.findMany({
      where: { createdAt: { gte: baselineStart, lt: currentStart } },
      orderBy: { createdAt: "desc" },
      take: 2_000,
    }),
    db.mlEvaluationRun.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);
  const byCapability = new Map<string, { total: number; success: number; confidence: number[] }>();
  for (const event of recent) {
    const row = byCapability.get(event.capability) ?? { total: 0, success: 0, confidence: [] };
    row.total += 1;
    if (event.outcome === "SUCCESS") row.success += 1;
    if (event.confidence !== null) row.confidence.push(event.confidence);
    byCapability.set(event.capability, row);
  }
  const summarize = (events: typeof baselineEvents) => {
    const map = new Map<string, { total: number; success: number; confidence: number[] }>();
    for (const event of events) {
      const row = map.get(event.capability) ?? { total: 0, success: 0, confidence: [] };
      row.total += 1;
      if (event.outcome === "SUCCESS") row.success += 1;
      if (event.confidence !== null) row.confidence.push(event.confidence);
      map.set(event.capability, row);
    }
    return map;
  };
  const baseline = summarize(baselineEvents);
  return {
    controls,
    latestEvaluation,
    metrics: [...byCapability.entries()].map(([capability, row]) => {
      const previous = baseline.get(capability) ?? { total: 0, success: 0, confidence: [] };
      const coverage = row.total ? row.success / row.total : 0;
      const meanConfidence = row.confidence.length
        ? row.confidence.reduce((sum, value) => sum + value, 0) / row.confidence.length
        : null;
      const drift = assessMlDrift(
        { sampleCount: row.total, coverage, meanConfidence, correctionRate: null },
        {
          sampleCount: previous.total,
          coverage: previous.total ? previous.success / previous.total : 0,
          meanConfidence: previous.confidence.length
            ? previous.confidence.reduce((sum, value) => sum + value, 0) / previous.confidence.length
            : null,
          correctionRate: null,
        },
      );
      return { capability, sampleCount: row.total, coverage, meanConfidence, drift };
    }),
  };
}
