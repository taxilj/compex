import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VendorRfqsPage from "./page";

const api = vi.hoisted(() => ({
  listVendors: vi.fn(),
  listVendorRfqs: vi.fn(),
  getAdminRfq: vi.fn(),
  createVendorRfq: vi.fn(),
  sendVendorRfq: vi.fn(),
  recordVendorQuote: vi.fn(),
  selectVendorQuote: vi.fn(),
  createQuotationFromSourcing: vi.fn(),
}));

vi.mock("@/lib/api/admin", () => api);
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

beforeEach(() => {
  vi.clearAllMocks();
  api.listVendors.mockResolvedValue({ data: [], total: 0, page: 1, limit: 50 });
  api.listVendorRfqs.mockResolvedValue({
    data: [{
      id: "vr-1",
      vendorRfqNumber: "VRFQ-TEST-1",
      rfqId: "rfq-1",
      vendorId: "v-1",
      status: "SENT",
      emailSentAt: null,
      notes: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      vendor: { id: "v-1", name: "Test Vendor", contactEmail: null },
      items: [{ id: "vi-1", rfqItemId: "ri-1", quantity: 5, notes: null }],
      quotes: [],
    }],
    total: 1,
    page: 1,
    limit: 100,
  });
});

// A <select> sized by its longest <option> is an unshrinkable flex item: at 375px it overhung the
// content column by 37px (Phase 9 F15). Capping it at the container width lets it shrink instead.
describe("vendor RFQ quote form", () => {
  it("lets the RFQ-line select shrink to the container instead of overhanging a phone viewport", async () => {
    render(<VendorRfqsPage />);
    const select = await screen.findByRole("combobox");
    const tokens = select.className.split(/\s+/);
    expect(tokens).toEqual(expect.arrayContaining(["max-w-full"]));
  });
});
