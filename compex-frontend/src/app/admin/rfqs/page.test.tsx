import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminRFQsPage from "./page";

const api = vi.hoisted(() => ({ listAdminRfqs: vi.fn() }));

vi.mock("@/lib/api/admin", () => api);

beforeEach(() => {
  vi.clearAllMocks();
  api.listAdminRfqs.mockResolvedValue({ data: [], total: 0, page: 1, limit: 50 });
});

const tokens = (element: Element | null) => (element?.className ?? "").split(/\s+/);

// The admin layout gives its content p-4 on phones and p-8 from md. These bars bleed to the
// edge of that padding with negative margins, so the negative margin must follow the gutter:
// a fixed -mx-8 overhung the phone viewport by 16px and made the content column scroll sideways.
describe("admin RFQ list header bars", () => {
  it("bleed by the phone gutter (16px) on small screens and by 32px from md", async () => {
    render(<AdminRFQsPage />);
    const heading = await screen.findByRole("heading", { name: "Requests for Quotation" });
    const titleBar = heading.parentElement!.parentElement!;
    const filterBar = screen.getByPlaceholderText("Search RFQ or customer...").parentElement!.parentElement!.parentElement!;

    for (const bar of [titleBar, filterBar]) {
      expect(tokens(bar)).toEqual(expect.arrayContaining(["-mx-4", "md:-mx-8", "px-4", "md:px-8"]));
      expect(tokens(bar)).not.toContain("-mx-8");
      expect(tokens(bar)).not.toContain("px-8");
    }
    expect(tokens(titleBar)).toEqual(expect.arrayContaining(["-mt-4", "md:-mt-8"]));
    expect(tokens(titleBar)).not.toContain("-mt-8");
  });
});
