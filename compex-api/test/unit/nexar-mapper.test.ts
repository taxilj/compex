import { describe, it, expect } from "vitest";
import { mapNexarPart, mapNexarInternalOffers, type NexarPart } from "../../src/modules/catalog-import/fetchers/nexar-mapper.js";

const fixture: NexarPart = {
  mpn: "STM32F103C8T6",
  slug: "stm32f103c8t6-stmicroelectronics",
  manufacturer: { name: "STMicroelectronics", homepageUrl: "https://www.st.com" },
  category: { id: "cat_1", name: "Embedded - Microcontrollers" },
  shortDescription: "IC MCU 32BIT 64KB FLASH 48LQFP",
  octopartUrl: "https://octopart.com/stm32f103c8t6-stmicroelectronics-12345",
  images: [{ url: "https://sigma.octopart.com/stm32f103.jpg", creditString: "Digi-Key", creditUrl: "https://digikey.com" }],
  bestDatasheet: { url: "https://www.st.com/resource/en/datasheet/stm32f103c8.pdf" },
  documentCollections: [
    { name: "Compliance", documents: [{ name: "Conflict Mineral Statement", url: "https://www.st.com/compliance/cmr.pdf", mimeType: "application/pdf" }] },
  ],
  specs: [
    { attribute: { name: "Package / Case", shortname: "package", group: "Physical" }, displayValue: "48-LQFP" },
    { attribute: { name: "Core Processor", shortname: "coreprocessor", group: "Technical" }, displayValue: "ARM Cortex-M3" },
    { attribute: { name: "Lifecycle Status", shortname: "lifecyclestatus", group: "Status" }, displayValue: "Production" },
    { attribute: { name: "RoHS Status", shortname: "rohsstatus", group: "Compliance" }, displayValue: "RoHS3 Compliant" },
  ],
  sellers: [
    {
      company: { name: "Digi-Key", homepageUrl: "https://digikey.com" },
      country: "US",
      isRfq: false,
      offers: [
        {
          sku: "497-STM32F103C8T6TR-ND",
          inventoryLevel: 12000,
          moq: 1,
          packaging: "Reel",
          factoryLeadDays: 45,
          clickUrl: "https://digikey.com/en/products/detail/stm32f103c8t6/497",
          prices: [{ quantity: 1, price: 3.5, currency: "USD" }],
        },
      ],
    },
  ],
};

describe("mapNexarPart (Nexar -> RawCatalogItem, public-safe)", () => {
  it("maps every documented public field into the shared catalog-import shape", () => {
    const item = mapNexarPart(fixture);
    expect(item.mpn).toBe("STM32F103C8T6");
    expect(item.manufacturer).toBe("STMicroelectronics");
    expect(item.description).toBe("IC MCU 32BIT 64KB FLASH 48LQFP");
    expect(item.category).toBe("Embedded - Microcontrollers");
    expect(item.datasheetUrl).toBe(fixture.bestDatasheet!.url);
    expect(item.sourceUrl).toBe(fixture.octopartUrl);
    expect(item.sourceProductId).toBe("stm32f103c8t6-stmicroelectronics");
    expect(item.images).toEqual(["https://sigma.octopart.com/stm32f103.jpg"]);
  });

  it("derives packageType from the Package/Case spec", () => {
    expect(mapNexarPart(fixture).packageType).toBe("48-LQFP");
  });

  it("surfaces lifecycleStatus from the lifecyclestatus spec instead of leaving it in specifications", () => {
    const item = mapNexarPart(fixture);
    expect(item.lifecycleStatus).toBe("Production");
    expect(item.specifications).not.toHaveProperty("Lifecycle Status");
  });

  it("folds non-lifecycle specs and RoHS status into specifications, and pulls in compliance document URLs, but never pricing", () => {
    const item = mapNexarPart(fixture);
    expect(item.specifications).toMatchObject({
      "Package / Case": "48-LQFP",
      "Core Processor": "ARM Cortex-M3",
      rohsStatus: "RoHS3 Compliant",
      complianceDocuments: ["https://www.st.com/compliance/cmr.pdf"],
    });
    expect(JSON.stringify(item)).not.toMatch(/price|moq|inventoryLevel|factoryLeadDays|sku/i);
  });

  it("produces an empty mpn (filtered out by the fetcher) when Part.mpn is missing", () => {
    expect(mapNexarPart({ ...fixture, mpn: undefined }).mpn).toBe("");
  });

  it("rejects a non-http datasheet/image/octopartUrl instead of passing it through", () => {
    const item = mapNexarPart({
      mpn: "X1",
      bestDatasheet: { url: "javascript:alert(1)" },
      images: [{ url: "not a url" }],
      octopartUrl: "ftp://example.com/x",
    });
    expect(item.datasheetUrl).toBeUndefined();
    expect(item.images).toBeUndefined();
    expect(item.sourceUrl).toBeUndefined();
  });

  it("omits datasheetUrl/images/specifications entirely when Nexar returns none, rather than empty placeholders", () => {
    const item = mapNexarPart({ mpn: "BARE1" });
    expect(item.datasheetUrl).toBeUndefined();
    expect(item.images).toBeUndefined();
    expect(item.specifications).toBeUndefined();
  });
});

describe("mapNexarInternalOffers (Nexar -> internal-sourcing-only offers)", () => {
  it("maps seller/offer/pricing data that mapNexarPart() never touches", () => {
    const offers = mapNexarInternalOffers(fixture);
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({
      seller: "Digi-Key",
      sellerHomepageUrl: "https://digikey.com/",
      country: "US",
      isRfq: false,
      sku: "497-STM32F103C8T6TR-ND",
      inventoryLevel: 12000,
      moq: 1,
      packaging: "Reel",
      factoryLeadDays: 45,
      offerUrl: "https://digikey.com/en/products/detail/stm32f103c8t6/497",
      prices: [{ quantity: 1, price: 3.5, currency: "USD" }],
    });
  });

  it("returns an empty array when Nexar has no seller/offer data", () => {
    expect(mapNexarInternalOffers({ mpn: "NOOFFERS" })).toEqual([]);
  });

  it("flattens offers across multiple sellers", () => {
    const twoSellers: NexarPart = {
      mpn: "X2",
      sellers: [
        { company: { name: "Digi-Key" }, offers: [{ sku: "A" }] },
        { company: { name: "Mouser" }, offers: [{ sku: "B" }, { sku: "C" }] },
      ],
    };
    const offers = mapNexarInternalOffers(twoSellers);
    expect(offers.map((o) => o.sku)).toEqual(["A", "B", "C"]);
  });
});
