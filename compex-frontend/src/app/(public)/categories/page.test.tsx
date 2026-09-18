import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CategoriesPage from "./page";
import { listCategories, type CategoryWithChildren } from "@/lib/api/products";

vi.mock("@/lib/api/products", () => ({ listCategories: vi.fn() }));
vi.mock("@/components/ui/CTABanner", () => ({ default: () => <div data-testid="cta-banner" /> }));

const realCategory: CategoryWithChildren = {
  id: "real-category",
  name: "Real Category",
  description: null,
  parentId: null,
  children: [],
  _count: { products: 4 },
};

beforeEach(() => {
  vi.mocked(listCategories).mockReset();
});

describe("CategoriesPage", () => {
  it("keeps an API failure distinct from an empty catalogue and retries", async () => {
    vi.mocked(listCategories)
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce([realCategory]);

    render(<CategoriesPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Categories are temporarily unavailable");
    expect(screen.queryByText("No categories in the catalogue yet")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    // "Real Category" now renders twice by design -- once in the sidebar
    // jump list, once as the section heading -- so assert on the set rather
    // than a single ambiguous match.
    expect(await screen.findAllByText("Real Category")).not.toHaveLength(0);
    await waitFor(() => expect(listCategories).toHaveBeenCalledTimes(2));
  });

  it("renders every supplied direct child instead of truncating the category card", async () => {
    vi.mocked(listCategories).mockResolvedValue([{
      ...realCategory,
      children: Array.from({ length: 5 }, (_, index) => ({
        ...realCategory,
        id: `child-${index}`,
        name: `Child ${index}`,
        parentId: realCategory.id,
      })),
    }]);

    render(<CategoriesPage />);

    expect(await screen.findByText("Child 4")).toBeInTheDocument();
  });
});
