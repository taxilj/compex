import { describe, expect, it } from "vitest";
import { extractElement14Products, mapElement14Part } from "../../src/modules/catalog-import/fetchers/element14-fetcher.js";
import { mapDigiKeyProduct } from "../../src/modules/catalog-import/fetchers/digikey-mapper.js";

describe("official distributor catalog mappers", () => {
  it("accepts the live Element14 manufacturerPartNumberSearchReturn envelope", () => {
    const products = extractElement14Products({
      manufacturerPartNumberSearchReturn: { products: [{ translatedManufacturerPartNumber: "STM32F103C8T6" }] },
    });
    expect(products).toHaveLength(1);
    expect(products[0].translatedManufacturerPartNumber).toBe("STM32F103C8T6");
  });

  it("builds the live Element14 public image URL from a baseName", () => {
    const item = mapElement14Part({ translatedManufacturerPartNumber: "X1", image: { baseName: "/EXAMPLE.jpg" } });
    expect(item.images).toEqual(["https://in.element14.com/productimages/standard/en_GB/EXAMPLE.jpg"]);
  });

  it("normalizes an element14 Product Search result without commercial pricing", () => {
    const item = mapElement14Part({
      sku: "1234567",
      translatedManufacturerPartNumber: "STM32F103C8T6",
      brandName: "STMicroelectronics",
      displayName: "STM32F103C8T6",
      productDescription: "32-bit microcontroller",
      category: { name: "Microcontrollers" },
      productURL: "https://in.element14.com/stmicroelectronics/stm32f103c8t6/mcu/dp/1234567",
      datasheets: [{ url: "https://www.st.com/resource/en/datasheet/stm32f103c8.pdf" }],
      image: { url: "https://media.element14.com/is/image/element14/1234567" },
      rohsStatus: "Compliant",
      attributes: [{ attributeLabel: "Package / Case", attributeValue: "LQFP-48" }],
    });

    expect(item).toMatchObject({
      mpn: "STM32F103C8T6",
      manufacturer: "STMicroelectronics",
      category: "Microcontrollers",
      sourceProductId: "1234567",
      packageType: "LQFP-48",
      specifications: { rohsStatus: "Compliant", "Package / Case": "LQFP-48" },
    });
    expect(item.images).toEqual(["https://media.element14.com/is/image/element14/1234567"]);
  });

  it("normalizes documented DigiKey catalog fields and excludes price fields", () => {
    const item = mapDigiKeyProduct({
      ManufacturerPartNumber: "ECA-1VHG102",
      DigiKeyProductNumber: "P5555-ND",
      Manufacturer: { Name: "Panasonic" },
      DetailedDescription: "Aluminium capacitor",
      Category: { Name: "Capacitors" },
      PrimaryDatasheet: "https://industrial.panasonic.com/datasheet.pdf",
      PrimaryPhoto: "https://media.digikey.com/photo.jpg",
      ProductUrl: "https://www.digikey.com/en/products/detail/panasonic/P5555-ND",
      RoHSStatus: "RoHS Compliant",
      Parameters: [{ Parameter: "Mounting Type", Value: "Through Hole" }],
    });

    expect(item).toMatchObject({
      mpn: "ECA-1VHG102",
      manufacturer: "Panasonic",
      sourceProductId: "P5555-ND",
      specifications: { rohsStatus: "RoHS Compliant", "Mounting Type": "Through Hole" },
    });
    expect(JSON.stringify(item)).not.toContain("Pricing");
  });
});
