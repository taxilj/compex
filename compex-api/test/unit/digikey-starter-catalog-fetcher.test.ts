import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.mock("../../src/config/env.js", () => ({
  env: { DIGIKEY_CLIENT_ID: "test-client-id", DIGIKEY_CLIENT_SECRET: "test-client-secret" },
}));
vi.stubGlobal("fetch", fetchMock);

const { createDigiKeyStarterCatalogFetcher } = await import("../../src/modules/catalog-import/fetchers/digikey-fetcher.js");

describe("createDigiKeyStarterCatalogFetcher", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "test-token", expires_in: 600 }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          Products: [{
            ManufacturerProductNumber: "ABC-123",
            ProductVariations: [{ DigiKeyProductNumber: "ABC-123-ND" }],
            Manufacturer: { Name: "Acme Components" },
            Category: { Name: "Supplier-specific category" },
            Description: { ProductDescription: "A real product" },
          }],
        }),
      });
  });

  it("uses a bounded official search and assigns the COMPEX main category", async () => {
    const fetcher = createDigiKeyStarterCatalogFetcher({ categoryName: "Passives", keywords: "resistor" }, 1);

    await expect(fetcher.fetch()).resolves.toEqual({
      items: [{
        mpn: "ABC-123",
        manufacturer: "Acme Components",
        description: "A real product",
        category: "Passives",
        sourceProductId: "ABC-123-ND",
        images: undefined,
        specifications: undefined,
        packageType: undefined,
        lifecycleStatus: undefined,
        datasheetUrl: undefined,
        sourceUrl: undefined,
      }],
      nextCursor: undefined,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://api.digikey.com/products/v4/search/keyword", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "X-DIGIKEY-Locale-Site": "IN" }),
      body: JSON.stringify({
        Keywords: "resistor",
        Limit: 50,
        Offset: 0,
        FilterOptionsRequest: {
          SearchOptions: ["InStock", "HasDatasheet", "HasProductPhoto"],
          MarketPlaceFilter: "ExcludeMarketPlace",
        },
      }),
    }));
  });
});
