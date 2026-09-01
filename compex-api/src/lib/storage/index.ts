export interface StorageProvider {
  put(key: string, data: Buffer, mimeType: string): Promise<void>;
  readFile(key: string): Promise<Buffer>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
}

export { LocalStorageProvider } from "./local.js";
export { S3StorageProvider } from "./s3.js";
