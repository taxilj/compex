/* eslint-disable @next/next/no-img-element -- Next Image is intentionally mocked in this unit test. */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HeroSection } from "./HeroSection";
import { listCategories } from "@/lib/api/products";

vi.mock("next/image", () => ({
  default: ({ fill, priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    void fill;
    void priority;
    return <img {...props} alt={props.alt ?? ""} />;
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/api/products", () => ({ listCategories: vi.fn() }));

beforeEach(() => {
  vi.mocked(listCategories).mockReset();
});

describe("HeroSection", () => {
  it("renders every real category cue beyond six and no static fallback taxonomy", async () => {
    vi.mocked(listCategories).mockResolvedValue(Array.from({ length: 8 }, (_, index) => ({
      id: `category-${index}`,
      name: `Real category ${index}`,
      description: null,
      parentId: null,
      children: [],
      _count: { products: 0 },
    })));

    render(<HeroSection />);

    expect(await screen.findByText("Real category 7")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Real category/ })).toHaveLength(8);
    expect(screen.queryByText("Semiconductors")).not.toBeInTheDocument();
  });
});
