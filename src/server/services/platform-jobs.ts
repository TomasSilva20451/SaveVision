import type { PlatformJobKind, PlatformJobStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { kindsWithCapacity } from "@/lib/platform/job-policy";
import { parsePlatformJobPayload } from "@/lib/platform/job-payload";

const LEASE_MS = 5 * 60 * 1000;

export async function enqueuePlatformJob(input: {
  kind: PlatformJobKind;
  payload: unknown;
  workspaceId?: string | null;
  requestedById?: string | null;
}) {
  const payload = parsePlatformJobPayload(input.kind, input.payload);
  return db.platformJob.create({
    data: {
      kind: input.kind,
      payload,
      workspaceId: input.workspaceId ?? ("workspaceId" in payload ? payload.workspaceId : null),
      requestedById: input.requestedById ?? null,
    },
  });
}

export async function claimNextPlatformJob(workerId: string) {
  const running = await db.platformJob.groupBy({
    by: ["kind"],
    where: { status: "RUNNING" },
    _count: { _all: true },
  });
  const runningByKind = Object.fromEntries(running.map((row) => [row.kind, row._count._all]));
  const allowed = kindsWithCapacity(runningByKind);
  if (allowed.length === 0) return null;

  const candidate = await db.platformJob.findFirst({
    where: {
      status: "QUEUED",
      availableAt: { lte: new Date() },
      kind: { in: allowed },
    },
    orderBy: { availableAt: "asc" },
  });
  if (!candidate) return null;

  const claimed = await db.platformJob.updateMany({
    where: { id: candidate.id, status: "QUEUED" },
    data: {
      status: "RUNNING",
      attempts: { increment: 1 },
      lockedBy: workerId,
      lockedUntil: new Date(Date.now() + LEASE_MS),
    },
  });
  if (claimed.count !== 1) return null;
  return db.platformJob.findUnique({ where: { id: candidate.id } });
}

export async function completePlatformJob(id: string, result: Record<string, string>) {
  await db.platformJob.update({
    where: { id },
    data: { status: "SUCCEEDED", result, error: null, finishedAt: new Date(), lockedBy: null, lockedUntil: null },
  });
}

export async function failPlatformJob(id: string, error: unknown) {
  const message = error instanceof Error ? error.message : "JOB_FAILED";
  const current = await db.platformJob.findUnique({ where: { id }, select: { attempts: true, maxAttempts: true } });
  const retry = current != null && current.attempts < current.maxAttempts;
  const status: PlatformJobStatus = retry ? "QUEUED" : "FAILED";
  await db.platformJob.update({
    where: { id },
    data: {
      status,
      error: message.slice(0, 500),
      lockedBy: null,
      lockedUntil: null,
      availableAt: retry ? new Date(Date.now() + 30_000) : undefined,
      finishedAt: retry ? null : new Date(),
    },
  });
}

export async function executeClaimedJob(job: { kind: PlatformJobKind; payload: unknown }) {
  const payload = parsePlatformJobPayload(job.kind, job.payload);
  return {
    handler: job.kind,
    accepted: "true",
    workspaceId: payload.workspaceId,
  };
}

export async function retryFailedPlatformJob(id: string) {
  const updated = await db.platformJob.updateMany({
    where: { id, status: "FAILED" },
    data: { status: "QUEUED", error: null, finishedAt: null, availableAt: new Date() },
  });
  return updated.count === 1;
}

export async function listPlatformJobs(limit = 50) {
  return db.platformJob.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      kind: true,
      status: true,
      attempts: true,
      error: true,
      workspaceId: true,
      createdAt: true,
      finishedAt: true,
    },
  });
}
