import { connection } from "next/server";
import { renderPrometheusMetrics, metricsSnapshotJson } from "@/lib/observability/metrics";
import { observeApiRoute } from "@/lib/observability/with-api-route";

function authorized(request: Request) {
  const token = process.env.FINTWIN_METRICS_TOKEN?.trim();
  if (!token) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization");
  return header === `Bearer ${token}`;
}

export async function GET(request: Request) {
  await connection();
  return observeApiRoute("/api/metrics", async () => {
    if (!authorized(request)) {
      return new Response("Unauthorized", { status: 401 });
    }
    const format = new URL(request.url).searchParams.get("format");
    if (format === "json") {
      return Response.json(metricsSnapshotJson());
    }
    return new Response(renderPrometheusMetrics(), {
      headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
    });
  });
}
