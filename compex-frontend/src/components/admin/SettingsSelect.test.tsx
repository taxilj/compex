import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsSelect } from "./SettingsSelect";
import { listSettings } from "@/lib/api/admin";

vi.mock("@/lib/api/admin", () => ({ listSettings: vi.fn() }));

beforeEach(() => { vi.mocked(listSettings).mockReset(); });

describe("SettingsSelect", () => {
  it("offers only active settings for new records", async () => {
    vi.mocked(listSettings).mockResolvedValue([{ id: "active", category: "COUNTRY", value: "India", sortOrder: 1, isEditable: true, isActive: true, createdAt: "", updatedAt: "" }]);
    render(<SettingsSelect category="COUNTRY" label="Country" value="" onChange={() => {}} />);

    expect(await screen.findByRole("option", { name: "India" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /inactive/i })).not.toBeInTheDocument();
    expect(listSettings).toHaveBeenCalledWith("COUNTRY");
  });

  it("shows an existing retired value honestly without adding it as a new option", async () => {
    vi.mocked(listSettings).mockResolvedValue([{ id: "active", category: "COUNTRY", value: "India", sortOrder: 1, isEditable: true, isActive: true, createdAt: "", updatedAt: "" }]);
    render(<SettingsSelect category="COUNTRY" label="Country" value="Retiredland" onChange={() => {}} />);

    expect(await screen.findByRole("option", { name: "Retiredland (inactive)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "India" })).toBeInTheDocument();
  });

  it("lets the admin retry after a failed load, then shows the options", async () => {
    vi.mocked(listSettings)
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce([{ id: "active", category: "COUNTRY", value: "India", sortOrder: 1, isEditable: true, isActive: true, createdAt: "", updatedAt: "" }]);
    render(<SettingsSelect category="COUNTRY" label="Country" value="" onChange={() => {}} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn.t load options/i);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(await screen.findByRole("option", { name: "India" })).toBeInTheDocument();
    expect(listSettings).toHaveBeenCalledTimes(2);
  });
});
