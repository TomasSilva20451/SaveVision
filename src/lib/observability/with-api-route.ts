import { headers } from "next/headers";
import { recordHttpMetric } from "@/lib/observability/metrics";

export async function observeApiRoute(route: string, handler: () => Promise<Response>): Promise<Response> {
  const started = performance.now();
  let status = 500;
  try {
    const response = await handler();
    status = response.status;
    return response;
  } finally {
    const headerStore = await headers();
    const template = headerStore.get("x-route-template") ?? route;
    recordHttpMetric(template, status, performance.now() - started);
  }
}
