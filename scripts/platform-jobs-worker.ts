import { randomUUID } from "node:crypto";
import { claimNextPlatformJob, completePlatformJob, executeClaimedJob, failPlatformJob } from "@/server/services/platform-jobs";

const limit = Number(process.env.FINTWIN_JOB_BATCH ?? "10");
const workerId = process.env.FINTWIN_JOB_WORKER_ID ?? randomUUID();
let processed = 0;

while (processed < limit) {
  const job = await claimNextPlatformJob(workerId);
  if (!job) break;
  try {
    const result = await executeClaimedJob(job);
    await completePlatformJob(job.id, result);
  } catch (error) {
    await failPlatformJob(job.id, error);
  }
  processed += 1;
}

console.log(`[jobs] worker ${workerId} processou ${processed}`);
