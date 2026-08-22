import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { startBomWorker } from "./jobs/bom-processor.js";
import { startFollowUpWorker } from "./jobs/follow-up-worker.js";

const app = await buildApp();

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  console.log(`[server] Listening on http://${env.HOST}:${env.PORT}`);

  // ponytail: single-process worker co-location — split to separate service if throughput demands it
  const bomWorker = startBomWorker();
  const followUpWorker = startFollowUpWorker();
  console.log("[server] BullMQ workers started");

  process.on("SIGTERM", async () => {
    await Promise.all([bomWorker.close(), followUpWorker.close()]);
    await app.close();
    process.exit(0);
  });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}