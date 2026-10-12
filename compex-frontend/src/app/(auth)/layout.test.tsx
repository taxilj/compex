/* eslint-disable @next/next/no-img-element -- Next Image is intentionally mocked in this unit test. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AuthLayout from "./layout";

vi.mock("next/image", () => ({
  default: ({ priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => {
    void priority;
    return <img {...props} alt={props.alt ?? ""} />;
  },
}));

describe("AuthLayout", () => {
  it("keeps the logo clickable to the homepage and offers a way back to the website", () => {
    render(<AuthLayout><p>form</p></AuthLayout>);
    expect(screen.getByRole("link", { name: "Compex Solution home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /Back to website/i })).toHaveAttribute("href", "/");
    expect(screen.getByText("form")).toBeInTheDocument();
  });
});
