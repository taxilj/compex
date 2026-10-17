import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CaseStudiesPage, { metadata } from "./page";

vi.mock("@/components/ui/CTABanner", () => ({ default: () => null }));

describe("case studies page", () => {
  it("is clearly labelled as illustrative and states it names no clients or results", () => {
    render(<CaseStudiesPage />);
    expect(screen.getByRole("note")).toHaveTextContent(/illustrative scenarios, not customer case histories/i);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Illustrative/);
    expect(String(metadata.description)).toMatch(/illustrative/i);
    expect(String(metadata.description)).toMatch(/not customer case histories/i);
  });

  it("makes no unsupported numeric, timeline or outcome claims", () => {
    const { container } = render(<CaseStudiesPage />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\b\d+\s*line items?\b/i);
    expect(text).not.toMatch(/\b\d+[- ]weeks?\b/i);
    expect(text).not.toMatch(/delivered|within the required window|production continuity|full traceability|guarantee/i);
  });

  it("points real requirements to the quote and contact pages", () => {
    render(<CaseStudiesPage />);
    expect(screen.getByRole("link", { name: "Request a quote" })).toHaveAttribute("href", "/request-quote");
    expect(screen.getByRole("link", { name: "contact the sales team" })).toHaveAttribute("href", "/contact");
  });
});
