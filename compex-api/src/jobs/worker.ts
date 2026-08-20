import { startBomWorker } from "./bom-processor.js";
import { startFollowUpWorker } from "./follow-up-worker.js";

console.log("[worker] Starting workers...");
const bomWorker = startBomWorker();
const followUpWorker = startFollowUpWorker();

process.on("SIGTERM", async () => {
  await Promise.all([bomWorker.close(), followUpWorker.close()]);
  process.exit(0);
});