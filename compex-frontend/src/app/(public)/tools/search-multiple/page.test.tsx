import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SearchMultiplePage from "./page";
import { lookupPublicProduct } from "@/lib/api/products";

vi.mock("@/lib/api/products", () => ({ lookupPublicProduct: vi.fn() }));
vi.mock("@/components/ui/CTABanner", () => ({ default: () => null }));

const product = { productName: "MCU", manufacturer: "ST", category: "ICs", datasheetUrl: null };
const type = (value: string) => fireEvent.change(screen.getByLabelText(/MPN list/i), { target: { value } });

beforeEach(() => {
  vi.mocked(lookupPublicProduct).mockReset();
});

describe("search multiple parts", () => {
  it("tells the user when parts beyond the limit are ignored", () => {
    render(<SearchMultiplePage />);
    type(Array.from({ length: 27 }, (_, i) => `PART${i}`).join("\n"));
    expect(screen.getByRole("status")).toHaveTextContent("2 more were ignored");
    expect(screen.getByText("25 / 25 parts")).toBeInTheDocument();
  });

  it("offers Retry on a failed lookup and re-queries only that part", async () => {
    vi.mocked(lookupPublicProduct)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ product } as never);
    render(<SearchMultiplePage />);
    type("LM358DR");
    fireEvent.click(screen.getByRole("button", { name: /Search Parts/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Lookup failed");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("link", { name: "View" })).toHaveAttribute("href", "/products/LM358DR");
    expect(lookupPublicProduct).toHaveBeenCalledTimes(2);
  });

  it("links a not-found part to a prefilled quote request", async () => {
    vi.mocked(lookupPublicProduct).mockResolvedValue({ product: null } as never);
    render(<SearchMultiplePage />);
    type("zz-1/2");
    fireEvent.click(screen.getByRole("button", { name: /Search Parts/i }));

    const link = await screen.findByRole("link", { name: /Request a quote for this part/i });
    expect(link).toHaveAttribute("href", "/request-quote?mpn=ZZ-1%2F2");
  });
});
