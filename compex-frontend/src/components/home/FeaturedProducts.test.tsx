import { describe, it, expect, vi, beforeEach } from "vitest";
import { StrictMode } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FeaturedProducts } from "./FeaturedProducts";
import { listProducts } from "@/lib/api/products";
import type { BackendProduct } from "@/lib/api/products";

vi.mock("@/lib/api/products", () => ({
  listProducts: vi.fn(),
}));

function makeProduct(overrides: Partial<BackendProduct> = {}): BackendProduct {
  const defaults: BackendProduct = {
    id: "p1",
    mpn: "STM32F103C8T6",
    name: null,
    description: "ARM Cortex-M3 MCU",
    specifications: null,
    packageType: "LQFP48",
    mountingType: null,
    lifecycleStatus: null,
    datasheetUrl: null,
    images: [],
    manufacturer: { id: "m1", name: "STMicroelectronics", slug: "st", logoUrl: null, website: null, description: null, country: null },
    category: null,
  };
  // Spread so an explicit `null`/`undefined` override (e.g. description: null)
  // is preserved instead of being replaced by the default via `??`.
  return { ...defaults, ...overrides };
}

function paginated(data: BackendProduct[]) {
  return { data, total: data.length, page: 1, limit: 8 };
}

beforeEach(() => {
  vi.mocked(listProducts).mockReset();
});

describe("FeaturedProducts", () => {
  it("renders all products returned by a valid API response", async () => {
    vi.mocked(listProducts).mockResolvedValue(
      paginated([makeProduct({ id: "p1", mpn: "STM32F103C8T6" }), makeProduct({ id: "p2", mpn: "LM324N" })]),
    );

    render(<FeaturedProducts />);

    expect(await screen.findByText("STM32F103C8T6")).toBeInTheDocument();
    expect(screen.getByText("LM324N")).toBeInTheDocument();
  });

  it("hides the section for a genuinely empty catalogue instead of showing a placeholder grid", async () => {
    vi.mocked(listProducts).mockResolvedValue(paginated([]));

    render(<FeaturedProducts />);

    await waitFor(() => expect(listProducts).toHaveBeenCalled());
    expect(screen.queryByText("Explore Electronic Components")).not.toBeInTheDocument();
  });

  it("shows an honest error state with a Retry action when the API fails, never a fake empty catalogue", async () => {
    vi.mocked(listProducts).mockRejectedValue(new Error("network error"));

    render(<FeaturedProducts />);

    expect(await screen.findByText(/Products temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("recovers real data after Retry following a failure", async () => {
    vi.mocked(listProducts)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce(paginated([makeProduct({ mpn: "LM324N" })]));

    render(<FeaturedProducts />);
    await screen.findByText(/Products temporarily unavailable/i);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("LM324N")).toBeInTheDocument();
    expect(screen.queryByText(/Products temporarily unavailable/i)).not.toBeInTheDocument();
    expect(listProducts).toHaveBeenCalledTimes(2);
  });

  it("never fires a duplicate initial fetch, even under React StrictMode's double-invoke (the guard against a stale-overwrite race)", async () => {
    // The mount effect defers `load()` inside a setTimeout and clears it on
    // cleanup -- so StrictMode's mount->cleanup->mount cycle cancels the
    // first timer before it ever fires, and `load` (and thus a network
    // request) only ever runs once per real mount. Combined with the
    // requestIdRef guard inside `load` itself, this is what makes a slower,
    // superseded response structurally unable to overwrite a newer one:
    // there is never more than one in-flight request to begin with.
    vi.mocked(listProducts).mockResolvedValue(paginated([makeProduct({ mpn: "STM32F103C8T6" })]));

    render(
      <StrictMode>
        <FeaturedProducts />
      </StrictMode>,
    );

    await screen.findByText("STM32F103C8T6");
    await waitFor(() => expect(listProducts).toHaveBeenCalledTimes(1));
  });

  it("does not create additional uncontrolled requests after a single Retry click", async () => {
    vi.mocked(listProducts)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce(paginated([makeProduct()]));

    render(<FeaturedProducts />);
    await screen.findByText(/Products temporarily unavailable/i);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("STM32F103C8T6");

    await waitFor(() => expect(listProducts).toHaveBeenCalledTimes(2));
  });

  it("keeps a product card visible with real fields even when optional data is missing (no image, no description)", async () => {
    vi.mocked(listProducts).mockResolvedValue(
      paginated([makeProduct({ mpn: "BARE-FIELDS", description: null, images: [], packageType: null })]),
    );

    render(<FeaturedProducts />);

    expect(await screen.findByText("BARE-FIELDS")).toBeInTheDocument();
    expect(screen.getByText("No description available.")).toBeInTheDocument();
  });

  it("keeps the product card visible when its image fails to load (ImageWithFallback swaps to the fallback icon)", async () => {
    vi.mocked(listProducts).mockResolvedValue(
      paginated([makeProduct({ mpn: "BROKEN-IMAGE", images: ["https://cdn.example.com/broken.jpg"] })]),
    );

    render(<FeaturedProducts />);
    await screen.findByText("BROKEN-IMAGE");

    const img = document.querySelector("img[src='https://cdn.example.com/broken.jpg']");
    expect(img).not.toBeNull();
    fireEvent.error(img as HTMLImageElement);

    expect(screen.getByText("BROKEN-IMAGE")).toBeInTheDocument();
  });
});
