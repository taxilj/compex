import { describe, it, expect, vi, beforeEach } from "vitest";

// Unit test for RFQ number format (mocks Prisma)
vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ nextval: 42n }]),
  },
}));

describe("RFQ number generator", () => {
  it("formats number with year and zero-padded sequence", async () => {
    const { nextRfqNumber } = await import("../../src/modules/rfqs/rfq-number.js");
    const num = await nextRfqNumber();
    const year = new Date().getFullYear();
    expect(num).toBe(`RFQ-${year}-000042`);
  });

  it("zero-pads single-digit sequences to 6 digits", async () => {
    const { prisma } = await import("../../src/lib/prisma.js");
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ nextval: 1n }]);
    const { nextRfqNumber } = await import("../../src/modules/rfqs/rfq-number.js");
    const num = await nextRfqNumber();
    const year = new Date().getFullYear();
    expect(num).toMatch(new RegExp(`RFQ-${year}-000001`));
  });
});