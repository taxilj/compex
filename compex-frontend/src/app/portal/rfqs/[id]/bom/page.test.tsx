import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import RFQBOMPage from "./page";
import { getRfq } from "@/lib/api/rfqs";
import { listRfqDocuments } from "@/lib/api/documents";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "rfq-1" }),
  notFound: vi.fn(),
}));

vi.mock("@/lib/api/rfqs", () => ({
  getRfq: vi.fn(),
}));

vi.mock("@/lib/api/documents", () => ({
  listRfqDocuments: vi.fn(),
}));

const rfq = {
  id: "rfq-1",
  rfqNumber: "RFQ-2026-000001",
  status: "SUBMITTED" as const,
  priority: "MEDIUM" as const,
  deliveryLocation: null,
  requiredDate: null,
  additionalNotes: null,
  submittedAt: null,
  createdAt: "2026-09-10T00:00:00.000Z",
  updatedAt: "2026-09-10T00:00:00.000Z",
  customerId: "customer-1",
  items: [
    {
      id: "item-1",
      rfqId: "rfq-1",
      productId: null,
      lineNumber: 1,
      mpn: "STM32F103C8T6",
      manufacturer: "STMicroelectronics",
      description: "ARM Cortex-M3 MCU",
      quantity: 10,
      targetPriceUsd: null,
      status: "PENDING",
      createdAt: "2026-09-10T00:00:00.000Z",
      updatedAt: "2026-09-10T00:00:00.000Z",
    },
  ],
};

beforeEach(() => {
  vi.mocked(getRfq).mockReset();
  vi.mocked(listRfqDocuments).mockReset();
});

describe("RFQBOMPage document panel", () => {
  it("shows the honest empty state when the documents request succeeds with zero documents", async () => {
    vi.mocked(getRfq).mockResolvedValue(rfq);
    vi.mocked(listRfqDocuments).mockResolvedValue([]);

    render(<RFQBOMPage />);

    expect(
      await screen.findByText("No BOM file uploaded — items on this RFQ were added manually."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Unable to load BOM document information")).not.toBeInTheDocument();
  });

  it("shows real file metadata when the documents request succeeds with a document", async () => {
    vi.mocked(getRfq).mockResolvedValue(rfq);
    vi.mocked(listRfqDocuments).mockResolvedValue([
      {
        id: "doc-1",
        fileName: "customer-bom.xlsx",
        documentType: "BOM",
        processingStatus: "COMPLETED",
        processingError: null,
        fileSizeBytes: 20480,
        createdAt: "2026-09-10T00:00:00.000Z",
      },
    ]);

    render(<RFQBOMPage />);

    expect(await screen.findByText("customer-bom.xlsx")).toBeInTheDocument();
    expect(screen.getByText("Processed")).toBeInTheDocument();
    expect(screen.queryByText(/No BOM file uploaded/)).not.toBeInTheDocument();
  });

  it("shows an honest error state with a Retry action when the documents request fails, without claiming no file was uploaded", async () => {
    vi.mocked(getRfq).mockResolvedValue(rfq);
    vi.mocked(listRfqDocuments).mockRejectedValueOnce(new Error("network error"));

    render(<RFQBOMPage />);

    expect(await screen.findByText("Unable to load BOM document information")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText(/No BOM file uploaded/)).not.toBeInTheDocument();

    // Retry re-fetches and can recover to the real state.
    vi.mocked(listRfqDocuments).mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() =>
      expect(
        screen.getByText("No BOM file uploaded — items on this RFQ were added manually."),
      ).toBeInTheDocument(),
    );
  });

  it("keeps the RFQ number and line items visible even when the documents request fails", async () => {
    vi.mocked(getRfq).mockResolvedValue(rfq);
    vi.mocked(listRfqDocuments).mockRejectedValueOnce(new Error("network error"));

    render(<RFQBOMPage />);

    await screen.findByText("Unable to load BOM document information");

    expect(screen.getByText(/RFQ-2026-000001/)).toBeInTheDocument();
    expect(screen.getByText("STM32F103C8T6")).toBeInTheDocument();
    expect(screen.getByText("STMicroelectronics")).toBeInTheDocument();
  });
});
