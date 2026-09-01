import { describe, expect, it, vi } from "vitest";
import { S3StorageProvider } from "../../src/lib/storage/s3.js";

describe("S3StorageProvider", () => {
  it("reads a private object into a buffer for BOM processing", async () => {
    const transformToByteArray = vi.fn().mockResolvedValue(new Uint8Array([65, 66, 67]));
    const send = vi.fn().mockResolvedValue({ Body: { transformToByteArray } });
    const storage = new S3StorageProvider() as unknown as { client: { send: typeof send }; readFile(key: string): Promise<Buffer> };
    storage.client = { send };

    await expect(storage.readFile("rfqs/test/bom.csv")).resolves.toEqual(Buffer.from("ABC"));
    expect(transformToByteArray).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledOnce();
  });

  it("rejects an object response without a body", async () => {
    const send = vi.fn().mockResolvedValue({});
    const storage = new S3StorageProvider() as unknown as { client: { send: typeof send }; readFile(key: string): Promise<Buffer> };
    storage.client = { send };

    await expect(storage.readFile("rfqs/test/missing.csv")).rejects.toThrow("Storage object has no body");
  });
});
