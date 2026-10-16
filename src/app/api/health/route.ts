import { connection } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  await connection();

  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "up" });
  } catch {
    return Response.json(
      { status: "degraded", database: "down" },
      { status: 503 },
    );
  }
}
