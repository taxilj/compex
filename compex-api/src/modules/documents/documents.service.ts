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