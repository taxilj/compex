import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "../../config/env.js";
import type { StorageProvider } from "./index.js";

// ponytail: local signed URLs use a simple HMAC — good for dev only
export class LocalStorageProvider implements StorageProvider {
  private basePath: string;
  private secret: string;

  constructor() {
    this.basePath = env.STORAGE_LOCAL_PATH;
    this.secret = env.JWT_SECRET;
  }

  async put(key: string, data: Buffer, _mimeType: string): Promise<void> {
    const dest = path.join(this.basePath, key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, data);
  }

  async getSignedUrl(key: string, expiresInSeconds = 60): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const sig = crypto
      .createHmac("sha256", this.secret)
      .update(`${key}:${expires}`)
      .digest("hex");
    // The API endpoint /documents/:id/download handles the actual serve
    return `/api/v1/documents/serve?key=${encodeURIComponent(key)}&expires=${expires}&sig=${sig}`;
  }

  async delete(key: string): Promise<void> {
    await fs.unlink(path.join(this.basePath, key)).catch(() => {});
  }

  async readFile(key: string): Promise<Buffer> {
    return fs.readFile(path.join(this.basePath, key));
  }

  verifySignedUrl(key: string, expires: number, sig: string): boolean {
    if (Date.now() / 1000 > expires) return false;
    const expected = crypto
      .createHmac("sha256", this.secret)
      .update(`${key}:${expires}`)
      .digest("hex");
    return crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  }
}