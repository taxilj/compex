import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProductSearchPage from "./page";
import { listProducts, listCategories } from "@/lib/api/products";
import { listManufacturers } from "@/lib/api/manufacturers";

const navigation = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));
vi.mock("@/lib/api/products", () => ({ listProducts: vi.fn(), listCategories: vi.fn() }));
vi.mock("@/lib/api/manufacturers", () => ({ listManufacturers: vi.fn() }));

beforeEach(() => {
  navigation.search = "";
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

  it("resets URL filters and aborts the old request when navigating to the full catalogue", async () => {
    navigation.search = "categoryId=old-category&manufacturerId=old-manufacturer&q=old";
    vi.mocked(listProducts).mockResolvedValue({ data: [], total: 0, page: 1, limit: 24 });
    const { rerender } = render(<ProductSearchPage />);

    await waitFor(() => expect(listProducts).toHaveBeenCalledWith(
      { q: "old", manufacturerId: "old-manufacturer", categoryId: "old-category", page: 1, limit: 24 },
      expect.any(AbortSignal),
    ));
    const previousSignal = vi.mocked(listProducts).mock.calls[0][1];

    navigation.search = "";
    rerender(<ProductSearchPage />);

    await waitFor(() => expect(listProducts).toHaveBeenLastCalledWith(
      { q: undefined, manufacturerId: undefined, categoryId: undefined, page: 1, limit: 24 },
      expect.any(AbortSignal),
    ));
    expect(previousSignal?.aborted).toBe(true);
  });
});
