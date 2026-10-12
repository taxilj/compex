import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PublicError from "./error";

describe("public error boundary", () => {
  it("shows a safe message, never the raw error, and retries via reset", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reset = vi.fn();
    render(<PublicError error={Object.assign(new Error("db password=hunter2"), { digest: "abc" })} reset={reset} />);

    expect(screen.getByRole("alert")).not.toHaveTextContent("hunter2");
    fireEvent.click(screen.getByRole("button", { name: /Try again/i }));
    expect(reset).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: /Home/i })).toHaveAttribute("href", "/");
  });
});
