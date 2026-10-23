export const AUTH_WINDOW_MS = 15 * 60 * 1000;
export const ACCOUNT_MAX_FAILURES = 5;
export const ACCOUNT_BLOCK_MS = 15 * 60 * 1000;
export const IP_MAX_FAILURES = 30;
export const IP_BLOCK_MS = 30 * 60 * 1000;
export const DEVICE_MAX_FAILURES = 12;
export const DEVICE_BLOCK_MS = 30 * 60 * 1000;
export const STUFFING_DISTINCT_ACCOUNTS = 8;
export const STUFFING_BLOCK_MS = 60 * 60 * 1000;

export type RateBucket = {
  failures: number;
  subjects: string[];
  windowStartedAt: number;
  blockedUntil: number | null;
};

export type RateDecision = {
  blocked: boolean;
  reason: "account" | "ip" | "device" | "stuffing" | null;
  bucket: RateBucket;
};

export function isBucketBlocked(bucket: RateBucket | undefined, now: number): boolean {
  return bucket?.blockedUntil != null && bucket.blockedUntil > now;
}

export function recordScopedFailure(
  current: RateBucket | undefined,
  now: number,
  options: {
    scope: "account" | "ip" | "device";
    maxFailures: number;
    blockMs: number;
    subject?: string;
    stuffingAt?: number;
  },
): RateDecision {
  if (isBucketBlocked(current, now)) {
    return { blocked: true, reason: options.scope, bucket: current! };
  }

  const inWindow = current != null && now - current.windowStartedAt < AUTH_WINDOW_MS;
  const subjects = new Set(inWindow ? current.subjects : []);
  if (options.subject) subjects.add(options.subject);
  const failures = inWindow ? current.failures + 1 : 1;
  const stuffing = options.stuffingAt != null && subjects.size >= options.stuffingAt;
  const blocked = stuffing || failures >= options.maxFailures;
  const blockMs = stuffing ? STUFFING_BLOCK_MS : options.blockMs;

  const bucket: RateBucket = {
    failures,
    subjects: [...subjects],
    windowStartedAt: inWindow ? current.windowStartedAt : now,
    blockedUntil: blocked ? now + blockMs : null,
  };

  return {
    blocked,
    reason: blocked ? (stuffing ? "stuffing" : options.scope) : null,
    bucket,
  };
}
