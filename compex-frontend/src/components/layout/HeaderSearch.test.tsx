import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HeaderSearch from "./HeaderSearch";
import { listProducts } from "@/lib/api/products";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/api/products", () => ({
  listProducts: vi.fn(),
}));

function makeProduct(overrides: {
  id?: string;
  mpn?: string;
  description?: string | null;
  manufacturerId?: string;
  manufacturerName?: string;
} = {}) {
  return {
    id: overrides.id ?? "p1",
    mpn: overrides.mpn ?? "STM32F103C8T6",
    name: null,
    description: overrides.description ?? "ARM Cortex-M3 MCU",
    specifications: null,
    packageType: null,
    mountingType: null,
    lifecycleStatus: null,
    datasheetUrl: null,
    images: [],
    manufacturer: {
      id: overrides.manufacturerId ?? "mfr-1",
      name: overrides.manufacturerName ?? "STMicroelectronics",
      slug: "stmicroelectronics",
      logoUrl: null,
      website: null,
      description: null,
      country: null,
    },
    category: null,
  };
}

function product(overrides: Parameters<typeof makeProduct>[0] = {}) {
  return makeProduct(overrides);
}

beforeEach(() => {
  vi.mocked(listProducts).mockReset();
  pushMock.mockReset();
});

describe("HeaderSearch", () => {
  it("shows live results after the debounce window", async () => {
    vi.mocked(listProducts).mockResolvedValue({ data: [product()], total: 1, page: 1, limit: 8 });

    render(<HeaderSearch />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "STM32" } });

    expect(await screen.findByText("STM32F103C8T6")).toBeInTheDocument();
    expect(screen.getByText(/STMicroelectronics/)).toBeInTheDocument();
  });

  it("shows an honest no-results state with a sourcing request link", async () => {
    vi.mocked(listProducts).mockResolvedValue({ data: [], total: 0, page: 1, limit: 8 });

    render(<HeaderSearch />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "NOTREAL999" } });

    expect(await screen.findByText(/No products found for/)).toBeInTheDocument();
    expect(screen.getByText(/Request sourcing/)).toBeInTheDocument();
  });

  it("never lets a slower, superseded request overwrite a newer one's results", async () => {
    // First query resolves slowly; second (newer) query resolves fast.
    // The final rendered state must reflect the second query only.
    const productA = product({ id: "a", mpn: "SLOW-STALE-RESULT" });
    const productB = product({ id: "b", mpn: "FAST-FRESH-RESULT" });
    let resolveFirst: (value: { data: (typeof productA)[]; total: number; page: number; limit: number }) => void = () => {};
    const firstPromise = new Promise<{ data: (typeof productA)[]; total: number; page: number; limit: number }>((resolve) => {
      resolveFirst = resolve;
    });

    vi.mocked(listProducts)
      .mockImplementationOnce(() => firstPromise)
      .mockImplementationOnce(() => Promise.resolve({ data: [productB], total: 1, page: 1, limit: 8 }));

    render(<HeaderSearch />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "slow" } });
    await waitFor(() => expect(listProducts).toHaveBeenCalledTimes(1));

    fireEvent.change(input, { target: { value: "fast" } });
    await waitFor(() => expect(listProducts).toHaveBeenCalledTimes(2));

    expect(await screen.findByText("FAST-FRESH-RESULT")).toBeInTheDocument();

    // Now let the slow first request resolve -- it must not clobber the
    // already-displayed, newer result.
    resolveFirst({ data: [productA], total: 1, page: 1, limit: 8 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByText("FAST-FRESH-RESULT")).toBeInTheDocument();
    expect(screen.queryByText("SLOW-STALE-RESULT")).not.toBeInTheDocument();
  });

  it("closes the results dropdown on Escape", async () => {
    vi.mocked(listProducts).mockResolvedValue({ data: [product()], total: 1, page: 1, limit: 8 });

    render(<HeaderSearch />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "STM32" } });
    await screen.findByText("STM32F103C8T6");

    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByText("STM32F103C8T6")).not.toBeInTheDocument();
  });

  it("shows an honest API-error state with a Retry action that re-issues the search", async () => {
    vi.mocked(listProducts).mockRejectedValueOnce(new Error("network error"));

    render(<HeaderSearch />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "STM32" } });

    expect(await screen.findByText("Search failed. Please try again.")).toBeInTheDocument();

    vi.mocked(listProducts).mockResolvedValueOnce({ data: [product()], total: 1, page: 1, limit: 8 });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("STM32F103C8T6")).toBeInTheDocument();
    expect(screen.queryByText("Search failed. Please try again.")).not.toBeInTheDocument();
  });

  it("navigates to the highlighted result on Enter", async () => {
    vi.mocked(listProducts).mockResolvedValue({ data: [product()], total: 1, page: 1, limit: 8 });

    render(<HeaderSearch />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "STM32" } });
    await screen.findByText("STM32F103C8T6");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(pushMock).toHaveBeenCalledWith("/products/STM32F103C8T6?manufacturerId=mfr-1");
  });
});
