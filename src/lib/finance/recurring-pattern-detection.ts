import { civilDateFromInstant, formatCivilDateIso } from "@/lib/datetime/civil-date";
import { decimal } from "@/lib/finance/money";
import { normalizeCategorizationPattern } from "@/lib/finance/transaction-categorization";
import type { RecurrenceFrequency } from "@/lib/finance/recurring-schedule";

export type RecurringPatternTransaction = {
  id: string;
  occurredAt: Date;
  amount: string;
  description: string;
  categoryId: string | null;
  accountId: string;
};

export type DetectedRecurringPattern = {
  suggestionKey: string;
  merchantPattern: string;
  merchantDisplay: string;
  frequency: RecurrenceFrequency;
  expectedAmount: string;
  confidence: number;
  transactionIds: string[];
  evidence: Array<{
    id: string;
    occurredAt: string;
    amount: string;
    description: string;
  }>;
  medianIntervalDays: number;
  dueDayOfMonth: number | null;
  startDate: string;
  dominantCategoryId: string | null;
  dominantAccountId: string | null;
  intervalScore: number;
  amountScore: number;
};

const MIN_OCCURRENCES = 3;
const LOOKBACK_MONTHS = 24;

const RETAIL_MERCHANT_TOKENS = [
  "CONTINENTE",
  "PINGO DOCE",
  "LIDL",
  "ALDI",
  "AUCHAN",
  "INTERMARCHE",
  "MERCADONA",
  "CARREFOUR",
  "EL CORTE INGLES",
  "MINIPRECO",
  "SPAR",
  "JUMBO",
  "APROACH",
  "PRIMARK",
  "ZARA",
  "H M",
  "IKEA",
] as const;

type FrequencySpec = {
  frequency: RecurrenceFrequency;
  targetDays: number;
  minDays: number;
  maxDays: number;
};

const FREQUENCY_SPECS: FrequencySpec[] = [
  { frequency: "WEEKLY", targetDays: 7, minDays: 6, maxDays: 8 },
  { frequency: "BIWEEKLY", targetDays: 14, minDays: 12, maxDays: 16 },
  { frequency: "MONTHLY", targetDays: 30, minDays: 27, maxDays: 33 },
  { frequency: "QUARTERLY", targetDays: 91, minDays: 85, maxDays: 95 },
  { frequency: "SEMIANNUAL", targetDays: 182, minDays: 175, maxDays: 190 },
  { frequency: "YEARLY", targetDays: 365, minDays: 350, maxDays: 380 },
];

function merchantPatternFromDescription(description: string): string {
  return normalizeCategorizationPattern(description);
}

function titleCaseFromPattern(pattern: string): string {
  return pattern
    .toLocaleLowerCase("pt-PT")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase("pt-PT") + part.slice(1))
    .join(" ");
}

export function isRetailLikeMerchant(pattern: string): boolean {
  const normalized = pattern.toLocaleUpperCase("pt-PT");
  return RETAIL_MERCHANT_TOKENS.some(
    (token) => normalized === token || normalized.includes(` ${token} `) || normalized.startsWith(`${token} `) || normalized.endsWith(` ${token}`),
  );
}

function amountTolerance(reference: ReturnType<typeof decimal>): ReturnType<typeof decimal> {
  const percent = reference.abs().mul("0.02");
  const floor = decimal("0.50");
  return percent.gt(floor) ? percent : floor;
}

function amountsCompatible(a: ReturnType<typeof decimal>, b: ReturnType<typeof decimal>): boolean {
  return a.sub(b).abs().lte(amountTolerance(a));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function matchFrequency(medianDays: number): FrequencySpec | null {
  return FREQUENCY_SPECS.find((spec) => medianDays >= spec.minDays && medianDays <= spec.maxDays) ?? null;
}

function civilIso(date: Date): string {
  return formatCivilDateIso(civilDateFromInstant(date));
}

function lookbackStart(from: Date): Date {
  const copy = new Date(from.getTime());
  copy.setUTCMonth(copy.getUTCMonth() - LOOKBACK_MONTHS);
  return copy;
}

function buildSuggestionKey(
  merchantPattern: string,
  frequency: RecurrenceFrequency,
  expectedAmount: string,
): string {
  return `${merchantPattern}|${frequency}|${decimal(expectedAmount).toFixed(2)}`;
}

function clusterByAmount(transactions: RecurringPatternTransaction[]): RecurringPatternTransaction[][] {
  const clusters: RecurringPatternTransaction[][] = [];
  for (const tx of transactions) {
    const amount = decimal(tx.amount).abs();
    const cluster = clusters.find((candidate) =>
      amountsCompatible(amount, decimal(candidate[0]!.amount).abs()),
    );
    if (cluster) cluster.push(tx);
    else clusters.push([tx]);
  }
  return clusters;
}

function dominantValue<T extends string | null>(values: T[]): T | null {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best: T | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = value as T;
    }
  }
  return best;
}

function analyzeCluster(
  merchantPattern: string,
  cluster: RecurringPatternTransaction[],
): DetectedRecurringPattern | null {
  if (cluster.length < MIN_OCCURRENCES) return null;
  const sorted = [...cluster].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const intervals: number[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const days = (sorted[index]!.occurredAt.getTime() - sorted[index - 1]!.occurredAt.getTime()) / 86_400_000;
    intervals.push(days);
  }
  const medianIntervalDays = median(intervals);
  const frequencySpec = matchFrequency(medianIntervalDays);
  if (!frequencySpec) return null;

  const intervalDeviation = stdDev(intervals);
  const intervalScore = Math.max(
    0,
    Math.min(1, 1 - intervalDeviation / Math.max(frequencySpec.targetDays * 0.35, 1)),
  );

  const amounts = sorted.map((tx) => decimal(tx.amount).abs().toNumber());
  const medianAmountValue = median(amounts);
  const amountDeviation = stdDev(amounts);
  const amountScore = Math.max(
    0,
    Math.min(1, 1 - amountDeviation / Math.max(medianAmountValue * 0.05, 0.01)),
  );

  const countScore = Math.min(1, (sorted.length - 2) / 5);
  const confidence = Number(
    (0.45 * intervalScore + 0.35 * amountScore + 0.2 * countScore).toFixed(3),
  );
  if (confidence < 0.55) return null;

  const expectedAmount = decimal(medianAmountValue).toFixed(2);
  const days = sorted.map((tx) => civilDateFromInstant(tx.occurredAt).day);
  const dayDeviation = stdDev(days);
  const dueDayOfMonth =
    frequencySpec.frequency === "MONTHLY" && dayDeviation <= 2.5 ? Math.round(median(days)) : null;

  return {
    suggestionKey: buildSuggestionKey(merchantPattern, frequencySpec.frequency, expectedAmount),
    merchantPattern,
    merchantDisplay: titleCaseFromPattern(merchantPattern),
    frequency: frequencySpec.frequency,
    expectedAmount,
    confidence,
    transactionIds: sorted.map((tx) => tx.id),
    evidence: sorted.map((tx) => ({
      id: tx.id,
      occurredAt: civilIso(tx.occurredAt),
      amount: decimal(tx.amount).abs().toFixed(2),
      description: tx.description.trim().slice(0, 160),
    })),
    medianIntervalDays: Number(medianIntervalDays.toFixed(1)),
    dueDayOfMonth,
    startDate: civilIso(sorted[0]!.occurredAt),
    dominantCategoryId: dominantValue(sorted.map((tx) => tx.categoryId)),
    dominantAccountId: dominantValue(sorted.map((tx) => tx.accountId)),
    intervalScore: Number(intervalScore.toFixed(3)),
    amountScore: Number(amountScore.toFixed(3)),
  };
}

export type ExistingRecurringSeries = {
  name: string;
  expectedAmount: string;
  frequency: RecurrenceFrequency;
  status: string;
};

function tokenOverlap(a: string, b: string): boolean {
  const tokensA = a.split(" ").filter((token) => token.length >= 3);
  const tokensB = new Set(b.split(" ").filter((token) => token.length >= 3));
  if (tokensA.length === 0 || tokensB.size === 0) return false;
  const shared = tokensA.filter((token) => tokensB.has(token));
  return shared.length >= Math.min(2, tokensA.length);
}

export function recurringSeriesMatchesPattern(
  series: ExistingRecurringSeries,
  pattern: DetectedRecurringPattern,
): boolean {
  if (series.status !== "ACTIVE" && series.status !== "PAUSED") return false;
  if (series.frequency !== pattern.frequency) return false;
  if (!amountsCompatible(decimal(series.expectedAmount).abs(), decimal(pattern.expectedAmount))) return false;

  const seriesKey = normalizeCategorizationPattern(series.name);
  if (!seriesKey || !pattern.merchantPattern) return false;
  return (
    seriesKey.includes(pattern.merchantPattern) ||
    pattern.merchantPattern.includes(seriesKey) ||
    seriesKey === pattern.merchantPattern ||
    tokenOverlap(seriesKey, pattern.merchantPattern)
  );
}

export function detectRecurringPatterns(input: {
  transactions: RecurringPatternTransaction[];
  now?: Date;
  existingSeries?: ExistingRecurringSeries[];
}): DetectedRecurringPattern[] {
  const now = input.now ?? new Date();
  const start = lookbackStart(now);
  const eligible = input.transactions.filter(
    (tx) => tx.occurredAt >= start && tx.description.trim().length >= 2,
  );

  const byMerchant = new Map<string, RecurringPatternTransaction[]>();
  for (const tx of eligible) {
    const pattern = merchantPatternFromDescription(tx.description);
    if (pattern.length < 2 || isRetailLikeMerchant(pattern)) continue;
    const bucket = byMerchant.get(pattern) ?? [];
    bucket.push(tx);
    byMerchant.set(pattern, bucket);
  }

  const detected: DetectedRecurringPattern[] = [];
  for (const [merchantPattern, group] of byMerchant) {
    for (const cluster of clusterByAmount(group)) {
      const candidate = analyzeCluster(merchantPattern, cluster);
      if (!candidate) continue;
      const duplicate = (input.existingSeries ?? []).some((series) =>
        recurringSeriesMatchesPattern(series, candidate),
      );
      if (duplicate) continue;
      detected.push(candidate);
    }
  }

  return detected.sort((a, b) => b.confidence - a.confidence || b.transactionIds.length - a.transactionIds.length);
}

function sortedIdKey(ids: string[]): string {
  return [...ids].sort().join(",");
}

export function findVerifiedRecurringPattern(input: {
  transactions: RecurringPatternTransaction[];
  existingSeries?: ExistingRecurringSeries[];
  suggestionKey: string;
  transactionIds: string[];
}): DetectedRecurringPattern | null {
  const providedKey = sortedIdKey(input.transactionIds);
  if (!providedKey) return null;

  const detected = detectRecurringPatterns({
    transactions: input.transactions,
    existingSeries: input.existingSeries,
  });

  return (
    detected.find(
      (pattern) =>
        pattern.suggestionKey === input.suggestionKey &&
        sortedIdKey(pattern.transactionIds) === providedKey,
    ) ?? null
  );
}
