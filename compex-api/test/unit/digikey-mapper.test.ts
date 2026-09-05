import { describe, it, expect } from "vitest";
import { mapDigiKeyProduct, type DigiKeyProduct } from "../../src/modules/catalog-import/fetchers/digikey-mapper.js";

// Fixture shaped after digikey-fetcher.ts's toDigiKeyProduct() output — the
// flattened shape mapDigiKeyProduct expects, independent of DigiKey's real
// nested Product Information V4 response (Product.Description.*, etc.),
// which digikey-fetcher.ts is responsible for flattening before this runs.
const fixture: DigiKeyProduct = {
  ManufacturerPartNumber: "STM32F103C8T6",
  DigiKeyProductNumber: "497-STM32F103C8T6TR-ND",
  ProductDescription: "IC MCU 32BIT 64KB FLASH 48LQFP",
  DetailedDescription: "ARM Cortex-M3 Microcontroller IC 32-Bit 72MHz 64KB (64K x 8) FLASH 48-LQFP",
  Manufacturer: "STMicroelectronics",
  PrimaryDatasheet: "https://www.st.com/resource/en/datasheet/stm32f103c8.pdf",
  PrimaryPhoto: "https://media.digikey.com/photos/stm32f103.jpg",
  ProductUrl: "https://www.digikey.com/en/products/detail/stmicroelectronics/STM32F103C8T6/2747117",
  RoHSStatus: "ROHS3 Compliant",
  Obsolete: false,
  Category: "Embedded - Microcontrollers",
  Parameters: [
    { Parameter: "Package / Case", Value: "48-LQFP" },
    { Parameter: "Core Processor", Value: "ARM Cortex-M3" },
  ],
};

describe("mapDigiKeyProduct (DigiKey -> RawCatalogItem)", () => {
  it("maps every documented field into the shared catalog-import shape", () => {
    const item = mapDigiKeyProduct(fixture);
    expect(item.mpn).toBe("STM32F103C8T6");
    expect(item.manufacturer).toBe("STMicroelectronics");
    expect(item.description).toBe(fixture.DetailedDescription);
    expect(item.category).toBe("Embedded - Microcontrollers");
    expect(item.datasheetUrl).toBe(fixture.PrimaryDatasheet);
    expect(item.sourceUrl).toBe(fixture.ProductUrl);
    expect(item.sourceProductId).toBe("497-STM32F103C8T6TR-ND");
    expect(item.images).toEqual([fixture.PrimaryPhoto]);
  });

  it("derives packageType from the Package/Case parameter", () => {
    expect(mapDigiKeyProduct(fixture).packageType).toBe("48-LQFP");
  });

  it("folds Parameters and RoHS status into specifications, never pricing", () => {
    const item = mapDigiKeyProduct(fixture);
    expect(item.specifications).toMatchObject({
      "Package / Case": "48-LQFP",
      "Core Processor": "ARM Cortex-M3",
      rohsStatus: "ROHS3 Compliant",
    });
    expect(JSON.stringify(item)).not.toMatch(/price/i);
  });

  it("marks lifecycleStatus Obsolete when the product is discontinued", () => {
    const item = mapDigiKeyProduct({ ...fixture, Obsolete: true });
    expect(item.lifecycleStatus).toBe("Obsolete");
  });

  it("produces an empty mpn (filtered out by the fetcher) when ManufacturerPartNumber is missing", () => {
    expect(mapDigiKeyProduct({ ...fixture, ManufacturerPartNumber: undefined }).mpn).toBe("");
  });

  it("rejects a non-http PrimaryDatasheet/PrimaryPhoto/ProductUrl instead of passing it through", () => {
    const item = mapDigiKeyProduct({
      ManufacturerPartNumber: "X1",
      PrimaryDatasheet: "javascript:alert(1)",
      PrimaryPhoto: "not a url",
      ProductUrl: "ftp://example.com/x",
    });
    expect(item.datasheetUrl).toBeUndefined();
    expect(item.images).toBeUndefined();
    expect(item.sourceUrl).toBeUndefined();
  });
});
