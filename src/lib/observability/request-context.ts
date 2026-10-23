import { AsyncLocalStorage } from "node:async_hooks";

export type RequestContext = {
  requestId: string;
  traceId: string;
  spanId: string;
  route?: string;
  journey?: string;
  startedAtMs: number;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function patchRequestContext(patch: Partial<RequestContext>) {
  const current = storage.getStore();
  if (!current) return;
  Object.assign(current, patch);
}
