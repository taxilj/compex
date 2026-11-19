import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ContactEntry } from "@/lib/api/admin";
import { ContactGrid } from "./ContactGrid";

describe("contact editing", () => {
  it("preserves rows, labels fields, updates legacy positions and supports explicit removal", () => {
    function Form() {
      const [rows, setRows] = useState<ContactEntry[]>([{ name: "Buyer", role: "Purchasing", remarks: "Keep this" }]);
      return <><ContactGrid value={rows} onChange={setRows} /><output>{JSON.stringify(rows)}</output></>;
    }
    render(<Form />);
    expect(screen.getByLabelText("Contact 1 Name")).toBeRequired();
    expect(screen.getByLabelText("Contact 1 Position")).toHaveValue("Purchasing");
    fireEvent.change(screen.getByLabelText("Contact 1 Position"), { target: { value: "Sourcing" } });
    expect(screen.getByRole("status")).toHaveTextContent('"role":"Sourcing"');
    expect(screen.getByLabelText("Contact 1 Remarks")).toHaveValue("Keep this");
    fireEvent.click(screen.getByRole("button", { name: "Add contact" }));
    expect(screen.getByLabelText("Contact 2 Name")).toBeRequired();
    fireEvent.click(screen.getByRole("button", { name: "Remove contact 2" }));
    expect(screen.queryByLabelText("Contact 2 Name")).not.toBeInTheDocument();
  });
});
