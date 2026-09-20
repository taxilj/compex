import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminVendorsPage from "./page";
import { ApiError } from "@/lib/api/client";
import { activateVendor, deactivateVendor, listSettings, listVendors, updateVendor, type Vendor } from "@/lib/api/admin";

vi.mock("@/lib/api/admin", () => ({
  listVendors: vi.fn(), createVendor: vi.fn(), updateVendor: vi.fn(), deactivateVendor: vi.fn(), activateVendor: vi.fn(),
  listSettings: vi.fn(),
}));

const vendor = (id: string, overrides: Partial<Vendor> = {}): Vendor => ({
  id, name: `Vendor ${id}`, contactEmail: `${id}@example.test`, contactPhone: null, address: null, notes: null,
  contactName: null, vendorCode: null, billToAddress: null, shipToAddress: null, country: null, telephone: null, fax: null,
  mobile: null, website: null, otherOffices: null, mov: null, paymentCurrency: null, paymentTerms: null, shippingAccount: null,
  bankDetails: null, creditLimit: null, industrySegment: null, businessType: null, speciality: null, gstOrRegistrationNumber: null,
  contacts: null, isActive: true, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", ...overrides,
});
const page = (data: Vendor[]) => ({ data, total: data.length, page: 1, limit: 100 });

beforeEach(() => {
  vi.mocked(listVendors).mockReset();
  vi.mocked(updateVendor).mockReset();
  vi.mocked(deactivateVendor).mockReset();
  vi.mocked(activateVendor).mockReset();
  vi.mocked(listSettings).mockResolvedValue([]);
});

describe("AdminVendorsPage", () => {
  it("shows the server's message when deactivate fails instead of failing silently", async () => {
    vi.mocked(listVendors).mockResolvedValue(page([vendor("a")]));
    vi.mocked(deactivateVendor).mockRejectedValueOnce(new ApiError(403, "FORBIDDEN", "Insufficient permissions"));
    render(<AdminVendorsPage />);
    await screen.findByText("Vendor a");

    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Insufficient permissions");
  });

  it("reloads and shows no error after a successful reactivate", async () => {
    vi.mocked(listVendors).mockResolvedValue(page([vendor("a", { isActive: false })]));
    vi.mocked(activateVendor).mockResolvedValueOnce(vendor("a"));
    render(<AdminVendorsPage />);
    await screen.findByText("Vendor a");

    fireEvent.click(screen.getByRole("button", { name: "Activate" }));
    await waitFor(() => expect(activateVendor).toHaveBeenCalledWith("a"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("never lets a slower, older search response overwrite the newer one", async () => {
    let resolveOld: (v: ReturnType<typeof page>) => void = () => {};
    vi.mocked(listVendors)
      .mockResolvedValueOnce(page([vendor("initial")]))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce(page([vendor("newest")]));
    render(<AdminVendorsPage />);
    await screen.findByText("Vendor initial");

    const search = screen.getByPlaceholderText(/Search vendor/);
    fireEvent.change(search, { target: { value: "a" } });
    await waitFor(() => expect(listVendors).toHaveBeenCalledTimes(2));
    fireEvent.change(search, { target: { value: "ab" } });
    await screen.findByText("Vendor newest");

    resolveOld(page([vendor("stale")]));
    await Promise.resolve();
    expect(screen.queryByText("Vendor stale")).not.toBeInTheDocument();
    expect(screen.getByText("Vendor newest")).toBeInTheDocument();
  });

  it("on edit sends only the changed field and an explicit null for an erased one, never the untouched retired value", async () => {
    const existing = vendor("a", { website: "https://old.example.test", businessType: "RetiredType" });
    vi.mocked(listVendors).mockResolvedValue(page([existing]));
    vi.mocked(updateVendor).mockResolvedValueOnce(existing);
    render(<AdminVendorsPage />);
    await screen.findByText("Vendor a");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit vendor" });
    const websiteInput = Array.from(dialog.querySelectorAll("input")).find((i) => (i as HTMLInputElement).value === "https://old.example.test") as HTMLInputElement;
    fireEvent.change(websiteInput, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateVendor).toHaveBeenCalledTimes(1));
    expect(vi.mocked(updateVendor).mock.calls[0]).toEqual(["a", { website: null }]);
  });

  it("shows which field the server rejected on a failed save", async () => {
    vi.mocked(listVendors).mockResolvedValue(page([vendor("a")]));
    vi.mocked(updateVendor).mockRejectedValueOnce(new ApiError(400, "VALIDATION_ERROR", "Invalid request data", [{ path: ["contactEmail"], message: "Invalid email" }]));
    render(<AdminVendorsPage />);
    await screen.findByText("Vendor a");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit vendor" });
    const email = Array.from(dialog.querySelectorAll("input")).find((i) => (i as HTMLInputElement).value === "a@example.test") as HTMLInputElement;
    fireEvent.change(email, { target: { value: "b@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/contactEmail: Invalid email/)).toBeInTheDocument();
  });
});
