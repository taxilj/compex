import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ErrorBoundary from "./error";

describe("route error recovery", () => {
  it("offers retry and home navigation without exposing internal errors", () => {
    const retry = vi.fn();
    render(<ErrorBoundary error={new Error("private database detail")} retry={retry} />);
    expect(screen.getByRole("alert")).not.toHaveTextContent("private database detail");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Go to homepage" })).toHaveAttribute("href", "/");
  });
});
