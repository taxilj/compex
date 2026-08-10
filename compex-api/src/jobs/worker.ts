import { startBomWorker } from "./bom-processor.js";

console.log("[worker] Starting BOM processing worker...");
const worker = startBomWorker();

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});