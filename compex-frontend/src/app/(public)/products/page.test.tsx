import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ProductSearchPage from "./page";
import { listProducts, listCategories } from "@/lib/api/products";
import { listManufacturers } from "@/lib/api/manufacturers";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/api/products", () => ({ listProducts: vi.fn(), listCategories: vi.fn() }));
vi.mock("@/lib/api/manufacturers", () => ({ listManufacturers: vi.fn() }));

beforeEach(() => {
  vi.mocked(listCategories).mockReset().mockResolvedValue([]);
  vi.mocked(listManufacturers).mockReset().mockResolvedValue({ data: [], total: 0, page: 1, limit: 100 });
  vi.mocked(listProducts).mockReset();
});

describe("product search error and retry", () => {
  it("shows an error (never 'No products found') when the load fails, and Retry refetches and recovers", async () => {
    vi.mocked(listProducts)
      .mockRejectedValueOnce(new Error("502"))
      .mockResolvedValueOnce({ data: [], total: 0, page: 1, limit: 24 });

    render(<ProductSearchPage />);

    expect(await screen.findByText("Could not load products. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText("No products found")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("No products found")).toBeInTheDocument();
    expect(screen.queryByText("Could not load products. Please try again.")).not.toBeInTheDocument();
    expect(listProducts).toHaveBeenCalledTimes(2);
  });
});
