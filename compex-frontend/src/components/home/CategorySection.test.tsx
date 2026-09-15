import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CategorySection } from "./CategorySection";
import { listCategories, type CategoryWithChildren } from "@/lib/api/products";

vi.mock("@/lib/api/products", () => ({
  listCategories: vi.fn(),
}));

function makeCategory(overrides: Partial<CategoryWithChildren> = {}): CategoryWithChildren {
  return {
    id: overrides.id ?? "c1",
    name: overrides.name ?? "Semiconductors",
    description: overrides.description ?? null,
    parentId: overrides.parentId ?? null,
    children: overrides.children ?? [],
    _count: overrides._count ?? { products: 12 },
  };
}

beforeEach(() => {
  vi.mocked(listCategories).mockReset();
});

describe("CategorySection", () => {
  it("shows a loading state instead of a blank/empty layout while categories are still loading", () => {
    vi.mocked(listCategories).mockReturnValue(new Promise(() => {})); // never resolves

    render(<CategorySection />);

    expect(screen.getByText(/Loading categories/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Semiconductors/i })).not.toBeInTheDocument();
  });

  it("hides the section entirely for 0 real categories (never invents placeholder cards)", async () => {
    vi.mocked(listCategories).mockResolvedValue([]);

    render(<CategorySection />);

    await waitFor(() => expect(listCategories).toHaveBeenCalled());
    expect(screen.queryByText("Browse by Category")).not.toBeInTheDocument();
  });

  it("renders a single category in a balanced, non-fixed-column grid", async () => {
    vi.mocked(listCategories).mockResolvedValue([makeCategory({ id: "c1", name: "Passives", _count: { products: 5 } })]);

    render(<CategorySection />);

    expect(await screen.findByText("Passives")).toBeInTheDocument();
    expect(screen.getByText("5 products")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /products$/ })).toHaveLength(1);
  });

  it("renders exactly 2 real categories with no blank placeholder cards filling the row (the reported bug)", async () => {
    vi.mocked(listCategories).mockResolvedValue([
      makeCategory({ id: "c1", name: "Connectors", _count: { products: 8 } }),
      makeCategory({ id: "c2", name: "Sensors", _count: { products: 3 } }),
    ]);

    render(<CategorySection />);

    expect(await screen.findByText("Connectors")).toBeInTheDocument();
    expect(screen.getByText("Sensors")).toBeInTheDocument();
    // Exactly 2 category cards -- no extra empty grid cells rendered to pad the row.
    expect(screen.getAllByRole("link", { name: /products$/ })).toHaveLength(2);
    // The layout fix: a responsive track list instead of a fixed column count.
    const grid = screen.getByText("Connectors").closest("a")!.parentElement!;
    expect(grid.getAttribute("style")).toContain("auto-fit");
  });

  it("renders 3+ real categories in a responsive grid", async () => {
    vi.mocked(listCategories).mockResolvedValue([
      makeCategory({ id: "c1", name: "Connectors" }),
      makeCategory({ id: "c2", name: "Sensors" }),
      makeCategory({ id: "c3", name: "Power" }),
      makeCategory({ id: "c4", name: "ICs" }),
    ]);

    render(<CategorySection />);

    await screen.findByText("Connectors");
    expect(screen.getAllByRole("link", { name: /products$/ })).toHaveLength(4);
  });

  it("renders every real category beyond six without an arbitrary cap", async () => {
    vi.mocked(listCategories).mockResolvedValue(
      Array.from({ length: 9 }, (_, index) => makeCategory({
        id: `category-${index}`,
        name: `Category ${index}`,
      })),
    );

    render(<CategorySection />);

    expect(await screen.findByText("Category 8")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /products$/ })).toHaveLength(9);
  });

  it("shows an honest error state with a Retry action on API failure", async () => {
    vi.mocked(listCategories).mockRejectedValue(new Error("network error"));

    render(<CategorySection />);

    expect(await screen.findByText(/Categories temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("recovers real categories after Retry following a failure", async () => {
    vi.mocked(listCategories)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce([makeCategory({ name: "Sensors", _count: { products: 3 } })]);

    render(<CategorySection />);
    await screen.findByText(/Categories temporarily unavailable/i);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Sensors")).toBeInTheDocument();
    expect(screen.queryByText(/Categories temporarily unavailable/i)).not.toBeInTheDocument();
    expect(listCategories).toHaveBeenCalledTimes(2);
  });

  it("renders only the real names and product counts returned by the API, nothing invented", async () => {
    vi.mocked(listCategories).mockResolvedValue([makeCategory({ name: "Microcontrollers", _count: { products: 42 } })]);

    render(<CategorySection />);

    expect(await screen.findByText("Microcontrollers")).toBeInTheDocument();
    expect(screen.getByText("42 products")).toBeInTheDocument();
  });
});
