import { NextResponse } from "next/server";
import { runPlatformJobsWorker } from "@/server/services/platform-jobs-worker";

export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const cronHeader = request.headers.get("x-vercel-cron");
  if (cronHeader === "1" && auth === `Bearer ${secret}`) return true;

  const querySecret = new URL(request.url).searchParams.get("secret");
  return querySecret === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const result = await runPlatformJobsWorker();
  return NextResponse.json({
    ok: true,
    workerId: result.workerId,
    processed: result.processed,
  });
}
