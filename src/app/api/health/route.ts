import { connection } from "next/server";
import { db } from "@/lib/db";
import { countUnavailableDocuments } from "@/server/services/document-integrity";
import { observeApiRoute } from "@/lib/observability/with-api-route";

export async function GET() {
  await connection();
  return observeApiRoute("/api/health", async () => {
    try {
      const [, tamperAttempts, unavailableDocuments] = await Promise.all([
        db.$queryRaw`SELECT 1`,
        db.auditTamperAttempt.count(),
        countUnavailableDocuments(),
      ]);
      if (tamperAttempts > 0) {
        return Response.json(
          {
            status: "critical",
            database: "up",
            audit: "tamper-attempt-detected",
            tamperAttempts,
            unavailableDocuments,
            uptimeSeconds: process.uptime(),
          },
          { status: 503 },
        );
      }
      const degraded = unavailableDocuments > 0;
      return Response.json(
        {
          status: degraded ? "degraded" : "ok",
          database: "up",
          audit: "verified-no-attempts",
          documents: degraded ? "unavailable-references" : "ok",
          unavailableDocuments,
          uptimeSeconds: process.uptime(),
          otel: process.env.FINTWIN_OTEL_ENABLED === "1",
        },
        degraded ? { status: 200 } : undefined,
      );
    } catch {
      return Response.json(
        { status: "degraded", database: "down", uptimeSeconds: process.uptime() },
        { status: 503 },
      );
    }
  });
}
