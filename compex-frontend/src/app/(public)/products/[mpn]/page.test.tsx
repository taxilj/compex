import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import ProductDetailPage from "./page";
import { getProduct, resolveProduct, type BackendProduct } from "@/lib/api/products";
import { ApiError } from "@/lib/api/client";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("manufacturerId=mfr-1"),
}));

vi.mock("@/lib/api/products", () => ({
  getProduct: vi.fn(),
  resolveProduct: vi.fn(),
}));

function makeProduct(overrides: Partial<BackendProduct> = {}): BackendProduct {
  return {
    id: "prod-1",
    mpn: "TLC555CP",
    name: "Timer IC",
    description: "Precision timer",
    specifications: { "Supply Voltage": "4.5V-16V" },
    packageType: "DIP-8",
    mountingType: "Through-Hole",
    lifecycleStatus: "ACTIVE",
    datasheetUrl: "https://example.com/datasheet.pdf",
    images: ["https://example.com/img.png"],
    manufacturer: { id: "mfr-1", name: "Texas Instruments", slug: "ti", logoUrl: null, website: null, description: null, country: null },
    category: { id: "cat-1", name: "Timers", description: null, parentId: null },
    ...overrides,
  };
}

async function renderPage(mpn = "TLC555CP") {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProductDetailPage params={Promise.resolve({ mpn })} />);
  });
  return result;
}

beforeEach(() => {
  vi.mocked(getProduct).mockReset();
  vi.mocked(resolveProduct).mockReset();
});

describe("product detail page", () => {
  it("renders a known local product immediately, without triggering the on-demand provider lookup", async () => {
    vi.mocked(getProduct).mockResolvedValue(makeProduct());

    await renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "TLC555CP" })).toBeInTheDocument();
    expect(screen.getByText("Texas Instruments")).toBeInTheDocument();
    expect(screen.getByText("DIP-8")).toBeInTheDocument();
    expect(resolveProduct).not.toHaveBeenCalled();
  });

  it("falls back to the controlled on-demand lookup only after a real 404, and renders the real result", async () => {
    vi.mocked(getProduct).mockRejectedValue(new ApiError(404, "NOT_FOUND", "Product not found"));
    vi.mocked(resolveProduct).mockResolvedValue({
      product: makeProduct({ mpn: "NEWPART1" }),
      sources: [{ provider: "MOUSER", status: "FOUND" }],
    });

    await renderPage("NEWPART1");

    await waitFor(() => expect(resolveProduct).toHaveBeenCalledWith("NEWPART1", "mfr-1"));
    expect(await screen.findByRole("heading", { level: 1, name: "NEWPART1" })).toBeInTheDocument();
  });

  it("shows an honest 'temporarily unavailable' note instead of a false not-found when providers fail", async () => {
    vi.mocked(getProduct).mockRejectedValue(new ApiError(404, "NOT_FOUND", "Product not found"));
    vi.mocked(resolveProduct).mockResolvedValue({
      product: null,
      sources: [
        { provider: "MOUSER", status: "TIMEOUT" },
        { provider: "DIGIKEY", status: "ERROR" },
        { provider: "ELEMENT14", status: "NO_MATCH" },
      ],
    });

    await renderPage("UNKNOWNPART");

    expect(await screen.findByText("Product not found")).toBeInTheDocument();
    expect(screen.getByText(/Some sources are temporarily unavailable/)).toBeInTheDocument();
  });

  it("shows a plain not-found (no unavailable caveat) when every provider gives a definitive no-match", async () => {
    vi.mocked(getProduct).mockRejectedValue(new ApiError(404, "NOT_FOUND", "Product not found"));
    vi.mocked(resolveProduct).mockResolvedValue({
      product: null,
      sources: [
        { provider: "MOUSER", status: "NO_MATCH" },
        { provider: "DIGIKEY", status: "NO_MATCH" },
        { provider: "ELEMENT14", status: "NO_MATCH" },
      ],
    });

    await renderPage("DEFINITELYFAKE");

    expect(await screen.findByText("Product not found")).toBeInTheDocument();
    expect(screen.queryByText(/temporarily unavailable/)).not.toBeInTheDocument();
  });

  it("shows a distinct ambiguous-manufacturer state on 409, never a false not-found", async () => {
    vi.mocked(getProduct).mockRejectedValue(new ApiError(409, "CONFLICT", "More than one manufacturer has this MPN."));

    await renderPage("SHAREDMPN");

    expect(await screen.findByText("Multiple manufacturers found")).toBeInTheDocument();
    expect(screen.queryByText("Product not found")).not.toBeInTheDocument();
    expect(resolveProduct).not.toHaveBeenCalled();
  });

  it("shows an honest error state (not a blank page or fake not-found) on an unexpected failure, without calling the on-demand lookup", async () => {
    vi.mocked(getProduct).mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "Something broke"));

    await renderPage();

    expect(await screen.findByText("Product lookup unavailable")).toBeInTheDocument();
    expect(screen.getByText("Something broke")).toBeInTheDocument();
    expect(resolveProduct).not.toHaveBeenCalled();
  });

  it("never renders an internal-looking specification key even if one leaked through", async () => {
    vi.mocked(getProduct).mockResolvedValue(makeProduct({
      specifications: { "Supply Voltage": "5V", "internalCost": "1.20", "supplierSku": "XYZ" },
    }));

    await renderPage();

    await screen.findByRole("heading", { level: 1, name: "TLC555CP" });
    expect(screen.getByText("Supply Voltage")).toBeInTheDocument();
    expect(screen.queryByText("internalCost")).not.toBeInTheDocument();
    expect(screen.queryByText("supplierSku")).not.toBeInTheDocument();
    expect(screen.queryByText("1.20")).not.toBeInTheDocument();
  });

  it("shows an honest 'datasheet unavailable' state rather than fabricating a link", async () => {
    vi.mocked(getProduct).mockResolvedValue(makeProduct({ datasheetUrl: null }));

    await renderPage();

    await screen.findByRole("heading", { level: 1, name: "TLC555CP" });
    expect(screen.getByText("Datasheet unavailable")).toBeInTheDocument();
  });
});
