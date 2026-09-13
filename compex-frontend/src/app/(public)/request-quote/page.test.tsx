import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RequestQuotePage from "./page";
import { submitPublicLead, getBomCapability, uploadLeadBom, getLeadBomStatus } from "@/lib/api/leads";

vi.mock("@/lib/api/leads", () => ({
  submitPublicLead: vi.fn(),
  getBomCapability: vi.fn(),
  uploadLeadBom: vi.fn(),
  getLeadBomStatus: vi.fn(),
}));

function makeFile(name: string, sizeBytes: number, type = "text/csv"): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

function fillCompanyDetails() {
  fireEvent.change(screen.getByLabelText("Company Name"), { target: { value: "Acme Pvt Ltd" } });
  fireEvent.change(screen.getByLabelText("Contact Person"), { target: { value: "Asha Buyer" } });
  fireEvent.change(screen.getByLabelText("Business Email"), { target: { value: "asha@example.com" } });
  fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "+91 98765 43210" } });
  fireEvent.change(screen.getByLabelText("Delivery City"), { target: { value: "Mumbai" } });
}

beforeEach(() => {
  vi.mocked(submitPublicLead).mockReset();
  vi.mocked(getBomCapability).mockReset();
  vi.mocked(uploadLeadBom).mockReset();
  vi.mocked(getLeadBomStatus).mockReset();
});

describe("BOM upload tab", () => {
  it("checks real backend capability instead of showing a hardcoded unavailable message", async () => {
    vi.mocked(getBomCapability).mockResolvedValue({ available: true });
    render(<RequestQuotePage />);

    fireEvent.click(screen.getByRole("button", { name: "BOM Enquiry" }));

    await waitFor(() => expect(getBomCapability).toHaveBeenCalled());
    expect(screen.queryByText(/durable document storage has not been verified/i)).not.toBeInTheDocument();
    await screen.findByText(/Click to browse or drag and drop/);
  });

  it("shows an honest degraded message (not a fake permanent one) when capability is really unavailable", async () => {
    vi.mocked(getBomCapability).mockResolvedValue({ available: false });
    render(<RequestQuotePage />);

    fireEvent.click(screen.getByRole("button", { name: "BOM Enquiry" }));

    expect(await screen.findByText(/Secure file upload is temporarily unavailable/i)).toBeInTheDocument();
  });

  it("rejects an unsupported file extension client-side without uploading anything", async () => {
    vi.mocked(getBomCapability).mockResolvedValue({ available: true });
    render(<RequestQuotePage />);
    fireEvent.click(screen.getByRole("button", { name: "BOM Enquiry" }));
    await screen.findByText(/Click to browse or drag and drop/);

    const input = document.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [makeFile("bom.pdf", 1000, "application/pdf")] } });

    expect(await screen.findByText("Only .xlsx and .csv files are supported.")).toBeInTheDocument();
    expect(screen.queryByText("bom.pdf")).not.toBeInTheDocument();
  });

  it("rejects a file over the 10 MB limit client-side", async () => {
    vi.mocked(getBomCapability).mockResolvedValue({ available: true });
    render(<RequestQuotePage />);
    fireEvent.click(screen.getByRole("button", { name: "BOM Enquiry" }));
    await screen.findByText(/Click to browse or drag and drop/);

    const input = document.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [makeFile("big.csv", 10 * 1024 * 1024 + 1)] } });

    expect(await screen.findByText("File exceeds the 10 MB limit.")).toBeInTheDocument();
  });

  it("shows the selected file's name/size with a remove option", async () => {
    vi.mocked(getBomCapability).mockResolvedValue({ available: true });
    render(<RequestQuotePage />);
    fireEvent.click(screen.getByRole("button", { name: "BOM Enquiry" }));
    await screen.findByText(/Click to browse or drag and drop/);

    const input = document.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [makeFile("bom.csv", 2048)] } });

    expect(await screen.findByText("bom.csv")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove selected file" }));
    expect(screen.queryByText("bom.csv")).not.toBeInTheDocument();
  });

  it("never claims success before upload+processing complete, then shows the real parsed line-item count", async () => {
    vi.mocked(getBomCapability).mockResolvedValue({ available: true });
    vi.mocked(submitPublicLead).mockResolvedValue({ id: "lead-1", referenceNumber: "ENQ-2026-000001", source: "BOM" });
    vi.mocked(uploadLeadBom).mockResolvedValue({
      documentId: "doc-1", fileName: "bom.csv", processingStatus: "COMPLETED", processingError: null, fileSizeBytes: 2048, validItemCount: 12, duplicate: false,
    });

    render(<RequestQuotePage />);
    fireEvent.click(screen.getByRole("button", { name: "BOM Enquiry" }));
    await screen.findByText(/Click to browse or drag and drop/);
    fillCompanyDetails();

    const input = document.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [makeFile("bom.csv", 2048)] } });
    await screen.findByText("bom.csv");

    fireEvent.click(screen.getByRole("button", { name: "Send BOM Enquiry" }));

    await screen.findByText("Enquiry Received");
    expect(uploadLeadBom).toHaveBeenCalledWith("lead-1", expect.any(File));
    expect(await screen.findByText("BOM processed — 12 components identified.")).toBeInTheDocument();
  });

  it("polls processing status and shows an honest failure with a retry option, never a fake success", async () => {
    vi.mocked(getBomCapability).mockResolvedValue({ available: true });
    vi.mocked(submitPublicLead).mockResolvedValue({ id: "lead-1", referenceNumber: "ENQ-2026-000002", source: "BOM" });
    vi.mocked(uploadLeadBom).mockResolvedValue({
      documentId: "doc-1", fileName: "bad.csv", processingStatus: "UPLOADED", processingError: null, fileSizeBytes: 500, duplicate: false,
    });
    vi.mocked(getLeadBomStatus).mockResolvedValue({
      documentId: "doc-1", fileName: "bad.csv", processingStatus: "FAILED", processingError: "No valid rows found in BOM (mpn + quantity required)", fileSizeBytes: 500,
    });

    render(<RequestQuotePage />);
    fireEvent.click(screen.getByRole("button", { name: "BOM Enquiry" }));
    await screen.findByText(/Click to browse or drag and drop/);
    fillCompanyDetails();

    const input = document.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [makeFile("bad.csv", 500)] } });
    await screen.findByText("bad.csv");

    fireEvent.click(screen.getByRole("button", { name: "Send BOM Enquiry" }));

    await screen.findByText("Enquiry Received");
    expect(await screen.findByText("No valid rows found in BOM (mpn + quantity required)", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText("Try a different file")).toBeInTheDocument();
    expect(screen.queryByText(/BOM processed/)).not.toBeInTheDocument();
  }, 10000);

  it("disables the submit button while a submission is in flight to prevent duplicate enquiries", async () => {
    vi.mocked(getBomCapability).mockResolvedValue({ available: true });
    let resolveSubmit: (v: { id: string; referenceNumber: string; source: "BOM" }) => void;
    vi.mocked(submitPublicLead).mockReturnValue(new Promise((resolve) => { resolveSubmit = resolve; }));

    render(<RequestQuotePage />);
    fireEvent.click(screen.getByRole("button", { name: "BOM Enquiry" }));
    await screen.findByText(/Click to browse or drag and drop/);
    fillCompanyDetails();

    const submitButton = screen.getByRole("button", { name: "Send BOM Enquiry" });
    fireEvent.click(submitButton);

    expect(await screen.findByRole("button", { name: "Sending…" })).toBeDisabled();
    resolveSubmit!({ id: "lead-1", referenceNumber: "ENQ-2026-000003", source: "BOM" });
    await screen.findByText("Enquiry Received");
  });
});
