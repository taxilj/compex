import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.mock("../../src/config/env.js", () => ({
  env: { DIGIKEY_CLIENT_ID: "test-client-id", DIGIKEY_CLIENT_SECRET: "test-client-secret" },
}));

vi.stubGlobal("fetch", fetchMock);

const { fetchDigiKeyManufacturers } = await import("../../src/modules/catalog-import/fetchers/digikey-fetcher.js");

describe("fetchDigiKeyManufacturers", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "test-token", expires_in: 600 }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          Manufacturers: [
            { Id: 15, Name: " Texas Instruments " },
            { Id: 99, Name: "STMicroelectronics" },
            { Id: "bad", Name: "Invalid" },
            { Id: 11, Name: " " },
          ],
        }),
      });
  });

  it("uses DigiKey's official manufacturer endpoint and keeps only valid IDs and names", async () => {
    await expect(fetchDigiKeyManufacturers()).resolves.toEqual([
      { id: 15, name: "Texas Instruments" },
      { id: 99, name: "STMicroelectronics" },
    ]);

    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://api.digikey.com/products/v4/search/manufacturers", {
      headers: expect.objectContaining({
        Authorization: "Bearer test-token",
        "X-DIGIKEY-Client-Id": "test-client-id",
        "X-DIGIKEY-Locale-Site": "US",
      }),
    });
  });
});
