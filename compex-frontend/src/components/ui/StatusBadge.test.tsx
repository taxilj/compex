import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./StatusBadge";

describe("commercial status labels", () => {
  it.each([["confirmed", "Confirmed"], ["sent", "Sent"], ["acknowledged", "Acknowledged"], ["issued", "Issued"], ["partially_paid", "Partially Paid"]])("labels %s clearly", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
