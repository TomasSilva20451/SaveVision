export type FixedWindowRateLimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfterSeconds: number;
};

export type FixedWindowRateLimitStore = {
  readonly backend: "redis" | "postgres";
  consume(key: string, limit: number, windowMs: number): Promise<FixedWindowRateLimitResult>;
};
