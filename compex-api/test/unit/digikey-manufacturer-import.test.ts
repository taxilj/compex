import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchDigiKeyManufacturers: vi.fn(),
  createMany: vi.fn(),
}));

vi.mock("../../src/modules/catalog-import/fetchers/digikey-fetcher.js", () => ({
  fetchDigiKeyManufacturers: () => mocks.fetchDigiKeyManufacturers(),
}));
vi.mock("../../src/lib/prisma.js", () => ({
  prisma: { manufacturer: { createMany: (...args: unknown[]) => mocks.createMany(...args) } },
}));

const { importDigiKeyManufacturers, DIGIKEY_MANUFACTURER_SOURCE_URL } = await import("../../src/modules/catalog-import/digikey-manufacturer-import.js");

describe("importDigiKeyManufacturers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchDigiKeyManufacturers.mockResolvedValue([
      { id: 1, name: "Acme Electronics" },
      { id: 2, name: " Acme Electronics " },
      { id: 3, name: "---" },
      { id: 4, name: "Zenith Components" },
    ]);
    mocks.createMany.mockResolvedValue({ count: 1 });
  });

  it("creates only new, unambiguous slugs and preserves existing master records", async () => {
    await expect(importDigiKeyManufacturers()).resolves.toEqual({
      retrieved: 4,
      created: 1,
      existing: 1,
      skipped: 2,
    });

    expect(mocks.createMany).toHaveBeenCalledWith({
      data: [
        { name: "Acme Electronics", slug: "acme-electronics", source: "DIGIKEY", sourceUrl: DIGIKEY_MANUFACTURER_SOURCE_URL },
        { name: "Zenith Components", slug: "zenith-components", source: "DIGIKEY", sourceUrl: DIGIKEY_MANUFACTURER_SOURCE_URL },
      ],
      skipDuplicates: true,
    });
  });
});
