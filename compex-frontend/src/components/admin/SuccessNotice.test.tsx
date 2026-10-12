import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SuccessNotice } from "./SuccessNotice";

describe("SuccessNotice", () => {
  it("announces the message politely and can be dismissed", () => {
    const onDismiss = vi.fn();
    render(<SuccessNotice message="Vendor created." onDismiss={onDismiss} />);
    expect(screen.getByRole("status")).toHaveTextContent("Vendor created.");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss message" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
