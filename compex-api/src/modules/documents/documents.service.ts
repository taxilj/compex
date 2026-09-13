import { Queue } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/errors.js";
import { LocalStorageProvider, S3StorageProvider } from "../../lib/storage/index.js";
import type { StorageProvider } from "../../lib/storage/index.js";
import { env } from "../../config/env.js";

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
    const connection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      retryStrategy: () => null,
    });
    _bomQueue = new Queue("bom-processing", { connection });
  }
  return _bomQueue;
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
    console.error("[storage] capability check failed:", error instanceof Error ? error.message : "Unknown error");
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