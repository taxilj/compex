import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ManufacturersGrid from "./ManufacturersGrid";
import { listManufacturers } from "@/lib/api/manufacturers";
import { listProducts } from "@/lib/api/products";

vi.mock("@/lib/api/manufacturers", () => ({
  listManufacturers: vi.fn(),
}));
vi.mock("@/lib/api/products", () => ({
  listProducts: vi.fn(),
}));

function mfr(id: string, name: string) {
  return {
    id, name, slug: name.toLowerCase(), logoUrl: null, website: null, description: null, country: null,
    _count: { products: 1 },
  };
}

beforeEach(() => {
  vi.mocked(listManufacturers).mockReset();
  vi.mocked(listProducts).mockReset();
  vi.mocked(listProducts).mockResolvedValue({ data: [], total: 0, page: 1, limit: 100 });
});

describe("ManufacturersGrid", () => {
  it("loads every manufacturer across multiple pages, never truncating to a single page", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => mfr(`m${i}`, `Mfr ${String(i).padStart(3, "0")}`));
    const page2 = [mfr("m100", "Mfr 100"), mfr("m101", "Mfr 101")];
    vi.mocked(listManufacturers)
      .mockResolvedValueOnce({ data: page1, total: 102, page: 1, limit: 100 })
      .mockResolvedValueOnce({ data: page2, total: 102, page: 2, limit: 100 });

    render(<ManufacturersGrid />);

    await waitFor(() => expect(listManufacturers).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Mfr 101")).toBeInTheDocument();
    expect(screen.getByText("Mfr 000")).toBeInTheDocument();
  });

  it("shows an honest error state with Retry (never a false empty list) when the API call fails", async () => {
    vi.mocked(listManufacturers).mockRejectedValueOnce(new Error("network error"));

    render(<ManufacturersGrid />);

    expect(await screen.findByText("Couldn't load manufacturers")).toBeInTheDocument();
    expect(screen.queryByText("No manufacturers in the catalogue yet")).not.toBeInTheDocument();

    vi.mocked(listManufacturers).mockResolvedValueOnce({ data: [mfr("m1", "Recovered Mfr")], total: 1, page: 1, limit: 100 });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Recovered Mfr")).toBeInTheDocument();
  });

  it("shows the genuine empty state only for a real zero-result response", async () => {
    vi.mocked(listManufacturers).mockResolvedValueOnce({ data: [], total: 0, page: 1, limit: 100 });

    render(<ManufacturersGrid />);

    expect(await screen.findByText("No manufacturers in the catalogue yet")).toBeInTheDocument();
  });
});
