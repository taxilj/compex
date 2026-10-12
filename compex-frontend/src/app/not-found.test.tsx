import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NotFound, { metadata } from "./not-found";

vi.mock("@/components/layout/PublicHeader", () => ({ default: () => <header data-testid="header" /> }));
vi.mock("@/components/layout/PublicFooter", () => ({ default: () => <footer data-testid="footer" /> }));

describe("custom 404", () => {
  it("keeps site chrome and offers working ways out", () => {
    render(<NotFound />);
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("find that page");
    expect(screen.getByRole("link", { name: /Back to Home/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /Request a quote/i })).toHaveAttribute("href", "/request-quote");
    expect(screen.getByRole("link", { name: /Contact us/i })).toHaveAttribute("href", "/contact");
  });

  it("is kept out of search results", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
