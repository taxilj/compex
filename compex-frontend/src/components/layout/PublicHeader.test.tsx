/* eslint-disable @next/next/no-img-element -- Next Image is intentionally mocked in this unit test. */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PublicHeader from "./PublicHeader";
import { listCategories } from "@/lib/api/products";

vi.mock("next/image", () => ({
  default: ({ priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => {
    void priority;
    return <img {...props} alt={props.alt ?? ""} />;
  },
}));
vi.mock("@/lib/api/products", () => ({ listCategories: vi.fn() }));
vi.mock("@/lib/api/manufacturers", () => ({ listManufacturers: vi.fn() }));
vi.mock("./HeaderSearch", () => ({ default: () => <div data-testid="header-search" /> }));

type CategoryFixture = {
  id: string; name: string; description: null; parentId: null; children: CategoryFixture[];
  _count: { products: number }; createdAt: string; updatedAt: string;
};

const category = (id: string, name: string, children: CategoryFixture[] = []): CategoryFixture => ({
  id, name, description: null, parentId: null, children, _count: { products: 0 }, createdAt: "", updatedAt: "",
});

beforeEach(() => { vi.mocked(listCategories).mockReset(); });

describe("PublicHeader categories", () => {
  it("shows every real main category in the Products menu and reveals its subcategories on hover", async () => {
    const categories = Array.from({ length: 7 }, (_, index) => category(`top-${index}`, `Top category ${index}`));
    categories[0] = category("top-0", "Top category 0", [category("child", "Child category", [category("grandchild", "Grandchild category")])]);
    vi.mocked(listCategories).mockResolvedValue(categories);
    render(<PublicHeader />);

    fireEvent.click(screen.getByRole("button", { name: /Products/i }));
    expect(await screen.findByText("Top category 6")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Grandchild category" })).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByRole("link", { name: "Top category 0" }));
    expect(screen.getByRole("link", { name: "Grandchild category" })).toHaveAttribute("href", "/products?categoryId=grandchild");
  });

  it("keeps category failures visible and retries instead of showing a false empty menu", async () => {
    vi.mocked(listCategories)
      .mockRejectedValueOnce(new Error("network failed"))
      .mockResolvedValueOnce([category("real", "Real category")]);
    render(<PublicHeader />);
    fireEvent.click(screen.getByRole("button", { name: /Products/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText("Real category")).toBeInTheDocument());
  });

  it("closes the category menu with Escape", async () => {
    vi.mocked(listCategories).mockResolvedValue([category("real", "Real category")]);
    render(<PublicHeader />);
    const trigger = screen.getByRole("button", { name: /Products/i });
    fireEvent.click(trigger);
    await screen.findByText("Real category");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
