import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewRFQPage from "./page";
import { addRfqItem, createRfq, submitRfq, uploadBom } from "@/lib/api/rfqs";
import { listRfqDocuments, type RfqDocument } from "@/lib/api/documents";

vi.mock("@/lib/api/rfqs", () => ({ createRfq: vi.fn(), addRfqItem: vi.fn(), submitRfq: vi.fn(), uploadBom: vi.fn() }));
vi.mock("@/lib/api/documents", () => ({ listRfqDocuments: vi.fn() }));

const document = (processingStatus: RfqDocument["processingStatus"]): RfqDocument => ({ id: "doc-1", fileName: "synthetic.csv", documentType: "BOM", processingStatus, processingError: null, fileSizeBytes: 20, createdAt: "2026-11-17" });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createRfq).mockResolvedValue({ id: "saved-rfq" } as never);
  vi.mocked(uploadBom).mockResolvedValue({ jobId: "doc-1", message: "Queued" });
  vi.mocked(submitRfq).mockResolvedValue({ id: "saved-rfq", status: "SUBMITTED" } as never);
});

function reviewBom() {
  render(<NewRFQPage />);
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.change(screen.getByLabelText("BOM file"), { target: { files: [new File(["mpn,quantity\nQA-001,2"], "synthetic.csv", { type: "text/csv" })] } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByRole("button", { name: "Submit RFQ" }));
}

describe("portal BOM submission", () => {
  it("waits for the uploaded document to finish before submitting the single saved RFQ", async () => {
    let finish!: (docs: RfqDocument[]) => void;
    const completed = new Promise<RfqDocument[]>((resolve) => { finish = resolve; });
    vi.mocked(listRfqDocuments).mockResolvedValueOnce([document("UPLOADED")]).mockReturnValueOnce(completed);
    reviewBom();
    await waitFor(() => expect(listRfqDocuments).toHaveBeenCalledTimes(2), { timeout: 2500 });
    expect(submitRfq).not.toHaveBeenCalled();
    await act(async () => { finish([document("COMPLETED")]); });
    expect(await screen.findByText("RFQ Submitted Successfully")).toBeInTheDocument();
    expect(createRfq).toHaveBeenCalledOnce();
    expect(submitRfq).toHaveBeenCalledWith("saved-rfq");
  });

  it.each(["FAILED", "missing", "request failed"])("keeps the saved RFQ reachable after %s status and prevents duplicate wizard retries", async (scenario) => {
    if (scenario === "request failed") vi.mocked(listRfqDocuments).mockRejectedValue(new Error("Private failure"));
    else vi.mocked(listRfqDocuments).mockResolvedValue(scenario === "missing" ? [] : [document("FAILED")]);
    reviewBom();
    expect(await screen.findByRole("link", { name: "Open saved RFQ" })).toHaveAttribute("href", "/portal/rfqs/saved-rfq");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Private failure");
    const submit = screen.getByRole("button", { name: "Submit RFQ" });
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(createRfq).toHaveBeenCalledOnce();
    expect(submitRfq).not.toHaveBeenCalled();
  });

  it("does not submit after the customer leaves while processing is pending", async () => {
    let finish!: (docs: RfqDocument[]) => void;
    vi.mocked(listRfqDocuments).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const view = render(<NewRFQPage />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("BOM file"), { target: { files: [new File(["data"], "synthetic.csv")] } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit RFQ" }));
    await waitFor(() => expect(listRfqDocuments).toHaveBeenCalled());
    view.unmount();
    await act(async () => { finish([document("COMPLETED")]); });
    expect(submitRfq).not.toHaveBeenCalled();
    expect(addRfqItem).not.toHaveBeenCalled();
  });
});
