import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminCustomersPage from "./page";
import { listCustomers, listUsers } from "@/lib/api/admin";

vi.mock("@/lib/api/admin", () => ({
  listCustomers: vi.fn(), listUsers: vi.fn(), createCustomer: vi.fn(), getCustomer: vi.fn(), updateCustomer: vi.fn(),
}));

const customer = (id: string, companyName = `Company ${id}`) => ({
  id, accountNumber: `CX-${id}`, createdAt: "2026-01-01", updatedAt: "2026-01-01",
  user: { id: `user-${id}`, email: `${id}@example.test`, firstName: "Test", lastName: "Customer", phone: null, status: "ACTIVE" as const },
  company: { id: `company-${id}`, name: companyName, gstin: null, city: null, address: null, shortName: null, billToAddress: null, shipToAddress: null, additionalShipToAddresses: null, state: null, country: null, relationshipType: null, customerType: null, website: null, fax: null, primaryContact: null, contactEmail: null, authorisedPerson: null, paymentTerms: null, creditLimit: null, region: null, internalAccountNumber: null, shippingAccount: null, bankDetails: null, industrySegment: null, remarks: null, contacts: null, salesPerson: null, salesCoordinator: null, sourcingOwner: null },
  _count: { rfqs: 0, quotations: 0 },
});

beforeEach(() => {
  vi.mocked(listUsers).mockResolvedValue({ data: [], total: 0, page: 1, limit: 100 });
  vi.mocked(listCustomers).mockReset();
});

describe("AdminCustomersPage", () => {
  it("uses bounded server-side pages and traverses past the first 100 records", async () => {
    vi.mocked(listCustomers)
      .mockResolvedValueOnce({ data: [customer("first")], total: 101, page: 1, limit: 50 })
      .mockResolvedValueOnce({ data: [customer("second")], total: 101, page: 2, limit: 50 });
    render(<AdminCustomersPage />);

    await screen.findByText("Company first");
    expect(listCustomers).toHaveBeenLastCalledWith({ q: undefined, page: 1, limit: 50 });
    expect(screen.getByText("Showing 1–50 of 101")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await screen.findByText("Company second");
    expect(listCustomers).toHaveBeenLastCalledWith({ q: undefined, page: 2, limit: 50 });
    expect(screen.getByText("Showing 51–100 of 101")).toBeInTheDocument();
  });

  it("resets to page one for server-side search and keeps API failures visible with retry", async () => {
    vi.mocked(listCustomers)
      .mockResolvedValueOnce({ data: [customer("first")], total: 101, page: 1, limit: 50 })
      .mockRejectedValueOnce(new Error("network failed"))
      .mockResolvedValueOnce({ data: [], total: 0, page: 1, limit: 50 });
    render(<AdminCustomersPage />);
    await screen.findByText("Company first");

    fireEvent.change(screen.getByLabelText("Search customers"), { target: { value: "GSTIN-101" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load customers.");
    expect(listCustomers).toHaveBeenLastCalledWith({ q: "GSTIN-101", page: 1, limit: 50 });

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText("No customers found.")).toBeInTheDocument());
    expect(listCustomers).toHaveBeenLastCalledWith({ q: "GSTIN-101", page: 1, limit: 50 });
  });
});
