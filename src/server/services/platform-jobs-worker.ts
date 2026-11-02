import { randomUUID } from "node:crypto";
import {
  claimNextPlatformJob,
  completePlatformJob,
  executeClaimedJob,
  failPlatformJob,
} from "@/server/services/platform-jobs";

export type PlatformJobsWorkerResult = {
  workerId: string;
  processed: number;
};

export async function runPlatformJobsWorker(options?: {
  limit?: number;
  workerId?: string;
}): Promise<PlatformJobsWorkerResult> {
  const limit = options?.limit ?? Number(process.env.FINTWIN_JOB_BATCH ?? "10");
  const workerId = options?.workerId ?? process.env.FINTWIN_JOB_WORKER_ID ?? randomUUID();
  let processed = 0;

  while (processed < limit) {
    const job = await claimNextPlatformJob(workerId);
    if (!job) break;
    try {
      const result = await executeClaimedJob({
        kind: job.kind,
        payload: job.payload,
        requestedById: job.requestedById ?? undefined,
        jobId: job.id,
      });
      await completePlatformJob(job.id, result);
    } catch (error) {
      await failPlatformJob(job.id, error);
    }
    processed += 1;
  }

  return { workerId, processed };
}
