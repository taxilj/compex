import { startBomWorker } from "./bom-processor.js";
import { startFollowUpWorker } from "./follow-up-worker.js";
import { startBomRecovery } from "./bom-recovery.js";
import { startNotificationRecovery } from "./notification-recovery.js";

console.log("[worker] Starting workers...");
const bomWorker = startBomWorker();
const followUpWorker = startFollowUpWorker();
const bomRecovery = startBomRecovery();
const notificationRecovery = startNotificationRecovery();

process.on("SIGTERM", async () => {
  await Promise.all([bomWorker.close(), followUpWorker.close(), bomRecovery.close(), notificationRecovery.close()]);
  process.exit(0);
});