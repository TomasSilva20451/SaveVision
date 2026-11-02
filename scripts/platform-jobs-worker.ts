import { runPlatformJobsWorker } from "@/server/services/platform-jobs-worker";

const result = await runPlatformJobsWorker();
console.log(`[jobs] worker ${result.workerId} processou ${result.processed}`);
