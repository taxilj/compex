import { describe, it, expect } from "vitest";
import { mapPart, type MouserPart } from "../../src/modules/catalog-import/fetchers/mouser-fetcher.js";

// Fixture shaped after Mouser's documented Search API Part object
// (Manufacturer, ManufacturerPartNumber, MouserPartNumber, Description,
// Category, DataSheetUrl, ImagePath, ProductDetailUrl, LifecycleStatus,
// ROHSStatus, ProductAttributes[]) — https://api.mouser.com/api/docs/ui/index
const fixturePart: MouserPart = {
  Manufacturer: "STMicroelectronics",
  ManufacturerPartNumber: "STM32F103C8T6",
  MouserPartNumber: "511-STM32F103C8T6",
  Description: "ARM Cortex-M3 Microcontroller IC 32-Bit 72MHz 64KB (64K x 8) FLASH 48-LQFP",
  Category: "Microcontrollers - MCU",
  DataSheetUrl: "https://www.st.com/resource/en/datasheet/stm32f103c8.pdf",
  ImagePath: "https://www.mouser.com/images/stmicroelectronics/images/stm32f103.jpg",
  ProductDetailUrl: "https://www.mouser.com/ProductDetail/STMicroelectronics/STM32F103C8T6",
  LifecycleStatus: "Active",
  ROHSStatus: "RoHS Compliant",
  ProductAttributes: [
    { AttributeName: "Package / Case", AttributeValue: "48-LQFP" },
    { AttributeName: "Core", AttributeValue: "ARM Cortex-M3" },
  ],
};

describe("mapPart (Mouser -> RawCatalogItem)", () => {
  it("maps every documented field into the shared catalog-import shape", () => {
    const item = mapPart(fixturePart);
    expect(item.mpn).toBe("STM32F103C8T6");
    expect(item.manufacturer).toBe("STMicroelectronics");
    expect(item.description).toBe(fixturePart.Description);
    expect(item.category).toBe("Microcontrollers - MCU");
    expect(item.datasheetUrl).toBe(fixturePart.DataSheetUrl);
    expect(item.sourceUrl).toBe(fixturePart.ProductDetailUrl);
    expect(item.sourceProductId).toBe("511-STM32F103C8T6");
    expect(item.lifecycleStatus).toBe("Active");
    expect(item.images).toEqual([fixturePart.ImagePath]);
  });

  it("derives packageType from the Package/Case product attribute", () => {
    const item = mapPart(fixturePart);
    expect(item.packageType).toBe("48-LQFP");
  });

  it("folds ProductAttributes and RoHS status into specifications", () => {
    const item = mapPart(fixturePart);
    expect(item.specifications).toMatchObject({
      "Package / Case": "48-LQFP",
      Core: "ARM Cortex-M3",
      rohsStatus: "RoHS Compliant",
    });
  });

  it("produces an empty mpn (filtered out by the fetcher) when ManufacturerPartNumber is missing", () => {
    const item = mapPart({ ...fixturePart, ManufacturerPartNumber: undefined });
    expect(item.mpn).toBe("");
  });

  it("omits images when Mouser returns no ImagePath", () => {
    const item = mapPart({ ...fixturePart, ImagePath: undefined });
    expect(item.images).toBeUndefined();
  });

  it("handles a part with no ProductAttributes or RoHS data gracefully", () => {
    const item = mapPart({ Manufacturer: "Acme", ManufacturerPartNumber: "X1" });
    expect(item.mpn).toBe("X1");
    expect(item.specifications).toBeUndefined();
    expect(item.packageType).toBeUndefined();
  });
});
