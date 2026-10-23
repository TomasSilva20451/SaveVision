import { connection } from "next/server";
import { db } from "@/lib/db";
import { observeApiRoute } from "@/lib/observability/with-api-route";

export async function GET() {
  await connection();
  return observeApiRoute("/api/health", async () => {
    try {
      const [, tamperAttempts] = await Promise.all([
        db.$queryRaw`SELECT 1`,
        db.auditTamperAttempt.count(),
      ]);
      if (tamperAttempts > 0) {
        return Response.json(
          {
            status: "critical",
            database: "up",
            audit: "tamper-attempt-detected",
            tamperAttempts,
            uptimeSeconds: process.uptime(),
          },
          { status: 503 },
        );
      }
      return Response.json({
        status: "ok",
        database: "up",
        audit: "verified-no-attempts",
        uptimeSeconds: process.uptime(),
        otel: process.env.FINTWIN_OTEL_ENABLED === "1",
      });
    } catch {
      return Response.json(
        { status: "degraded", database: "down", uptimeSeconds: process.uptime() },
        { status: 503 },
      );
    }
  });
}
