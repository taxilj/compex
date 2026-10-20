import { Queue } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/errors.js";
import { LocalStorageProvider, S3StorageProvider } from "../../lib/storage/index.js";
import type { StorageProvider } from "../../lib/storage/index.js";
import { env } from "../../config/env.js";
import { withTimeout } from "../../lib/async.js";
import { FAIL_FAST_REDIS_OPTIONS, describeRedisError, noteRedisError, rateLimitedLogger } from "../../lib/redis-options.js";
import { recordRedisWriteOk, redisHealth, resetRedisHealth } from "../../lib/redis-health.js";
import { describeError } from "../../lib/safe-log.js";

let _storage: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (!_storage) {
    _storage = env.STORAGE_PROVIDER === "s3"
      ? new S3StorageProvider()
      : new LocalStorageProvider();
  }
  return _storage;
}

let _bomQueue: Queue | null = null;

// Shared BullMQ producer for the "bom-processing" queue, used by both the
// authenticated portal upload (rfqId) and the public lead upload (leadId).
export function getBomQueue(): Queue {
  if (!_bomQueue) {
    // Producer connection: bounded retries/timeout so a request fails fast
    // with a clear error instead of hanging forever when Redis is
    // unreachable. (Workers legitimately use maxRetriesPerRequest: null for
    // blocking commands -- this is the producer side only.)
    const connection = new IORedis(env.REDIS_URL, FAIL_FAST_REDIS_OPTIONS);
    _bomQueue = new Queue("bom-processing", { connection });
    const logQueueError = rateLimitedLogger("bom-queue");
    _bomQueue.on("error", (err) => {
      noteRedisError(err);
      logQueueError(err);
    });
  }
  return _bomQueue;
}

const BOM_ENQUEUE_TIMEOUT_MS = 5000;
const QUEUE_PROBE_TIMEOUT_MS = 3000;
// The probe is a WRITE: a provider that has used up its quota still answers reads while
// rejecting writes and queue commands, so a read probe reports a Redis that cannot work.
const QUEUE_PROBE_KEY = "compex:health:probe";
const QUEUE_PROBE_TTL_SECONDS = 120;

export const BOM_QUEUE_UNAVAILABLE_MESSAGE =
  "Your BOM file was saved, but processing is temporarily unavailable. It will be processed automatically once the service recovers; you can also retry in a few minutes.";

let _queueProbe: Promise<boolean> | null = null;

// Test hook: forget what is known about Redis health.
export function resetBomQueueHealth(): void {
  resetRedisHealth();
  _queueProbe = null;
}

// Whether BOM processing can work right now. The shared Redis health memory (redis-health.ts)
// answers first: failures seen by the cache, the queue and the worker keep this false for a
// hold period without sending Redis anything, and a recent accepted write keeps it true
// without a probe. Only when nothing is known is ONE write probe sent (a real write, since a
// quota-exhausted provider still answers reads), so a failing or busy period costs at most a
// handful of commands per hour. Recovery is automatic: the hold expires and the next probe
// or any accepted cache/enqueue write marks Redis healthy again.
export async function isBomQueueAvailable(): Promise<boolean> {
  const health = redisHealth();
  if (health === "failing") return false;
  if (health === "ok") return true;
  _queueProbe ??= withTimeout(
    getBomQueue().client.then((client) => (client as unknown as IORedis).set(QUEUE_PROBE_KEY, "1", "EX", QUEUE_PROBE_TTL_SECONDS)),
    QUEUE_PROBE_TIMEOUT_MS,
    "BOM queue probe",
  )
    .then(() => {
      recordRedisWriteOk();
      return true;
    })
    .catch((error: unknown) => {
      noteRedisError(error);
      console.error(`[bom-queue] health probe failed: ${describeRedisError(error)}`);
      return false;
    })
    .finally(() => {
      _queueProbe = null;
    });
  return _queueProbe;
}

// Bounded, idempotent enqueue. The jobId is derived from the document id, so a
// retry (customer re-upload, recovery sweep, or a late-arriving first attempt)
// can never create a second parsing job; the worker's UPLOADED -> PROCESSING
// claim is a second guard.
//
// On failure the upload is RETAINED: the stored file and the Document row stay
// UPLOADED, which is the "pending" state -- nothing is marked FAILED, so the same
// document is re-enqueued later (see bom-recovery.ts) instead of the customer
// having to upload it again. The queue is reported unavailable so the upload page
// stops offering uploads until it recovers.
export async function enqueueBomJob(
  documentId: string,
  data: { documentId: string; rfqId?: string; leadId?: string; customerId?: string },
): Promise<void> {
  // Redis is known to be failing (quota, timeout, connection): keep the upload pending without
  // sending it another rejected command. The stored document stays UPLOADED and the recovery
  // sweep (bom-recovery.ts) enqueues it once Redis accepts writes again.
  if (redisHealth() === "failing") {
    console.error(`[bom-queue] enqueue skipped for document ${documentId}: Redis is failing; upload retained as pending`);
    throw Errors.serviceUnavailable(BOM_QUEUE_UNAVAILABLE_MESSAGE);
  }
  try {
    await withTimeout(
      // removeOnFail/removeOnComplete: a finished or failed job must not leave its jobId
      // behind, or a later re-add (recovery of a document stranded in PROCESSING) would be
      // a silent no-op. Duplicate parsing stays impossible: the worker only claims an
      // UPLOADED document and completes only a PROCESSING one.
      getBomQueue().add("parse-bom", data, { jobId: `bom-${documentId}`, removeOnFail: true, removeOnComplete: true }),
      BOM_ENQUEUE_TIMEOUT_MS,
      "BOM enqueue",
    );
    recordRedisWriteOk();
  } catch (error) {
    noteRedisError(error);
    console.error(`[bom-queue] enqueue failed for document ${documentId}: ${describeRedisError(error)}; upload retained as pending`);
    throw Errors.serviceUnavailable(BOM_QUEUE_UNAVAILABLE_MESSAGE);
  }
}

const STORAGE_CAPABILITY_CACHE_MS = 60_000;
let _capabilityCache: { available: boolean; checkedAt: number } | null = null;

// Real config + safe (non-destructive) connectivity check -- never a
// hardcoded/fake answer. Production already refuses to boot with anything
// other than STORAGE_PROVIDER=s3 (see config/env.ts), so this reflects
// actual verified state, cached briefly to avoid a live bucket check on
// every page view.
export async function isDurableStorageAvailable(): Promise<boolean> {
  if (env.STORAGE_PROVIDER !== "s3") return false;

  if (_capabilityCache && Date.now() - _capabilityCache.checkedAt < STORAGE_CAPABILITY_CACHE_MS) {
    return _capabilityCache.available;
  }

  let available: boolean;
  try {
    const storage = getStorage();
    if (storage instanceof S3StorageProvider) {
      await storage.headBucket();
    }
    available = true;
  } catch (error) {
    console.error(`[storage] capability check failed: ${describeError(error)}`);
    available = false;
  }

  _capabilityCache = { available, checkedAt: Date.now() };
  return available;
}

export async function getSignedDownloadUrl(
  documentId: string,
  customerId?: string,
  isStaff = false,
): Promise<string> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) throw Errors.notFound("Document");

  // Customers can only access their own documents
  if (!isStaff && doc.customerId !== customerId) throw Errors.notFound("Document");

  const storage = getStorage();
  return storage.getSignedUrl(doc.storageKey, 60);
}