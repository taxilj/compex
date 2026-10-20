import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminSettingsPage from "./page";
import { activateSetting, deactivateSetting, listSettingCategories, listSettings } from "@/lib/api/admin";

vi.mock("@/lib/api/admin", () => ({
  listSettingCategories: vi.fn(), listSettings: vi.fn(), createSetting: vi.fn(), updateSetting: vi.fn(), deleteSetting: vi.fn(), deactivateSetting: vi.fn(), activateSetting: vi.fn(),
}));

const setting = (isActive: boolean) => ({
  id: "country-1", category: "COUNTRY", value: "India", sortOrder: 0, isEditable: true, isActive, createdAt: "", updatedAt: "",
});

beforeEach(() => {
  vi.mocked(listSettingCategories).mockResolvedValue(["COUNTRY"]);
  vi.mocked(listSettings).mockReset();
  vi.mocked(deactivateSetting).mockResolvedValue(setting(false));
  vi.mocked(activateSetting).mockResolvedValue(setting(true));
});

describe("AdminSettingsPage", () => {
  it("deactivates and reactivates a setting while retaining inactive values in Settings", async () => {
    vi.mocked(listSettings)
      .mockResolvedValueOnce([setting(true)])
      .mockResolvedValueOnce([setting(false)])
      .mockResolvedValueOnce([setting(true)]);

    render(<AdminSettingsPage />);
    await screen.findByRole("button", { name: "Deactivate" });
    expect(listSettings).toHaveBeenCalledWith("COUNTRY", { includeInactive: true });

    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(deactivateSetting).toHaveBeenCalledWith("country-1"));
    expect(await screen.findByText("Inactive")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Activate" }));
    await waitFor(() => expect(activateSetting).toHaveBeenCalledWith("country-1"));
  });

  // At 375px the fixed 256px category list plus an unshrinkable editor pushed the whole admin
  // content area sideways. jsdom cannot compute Tailwind layout, so this pins the class
  // contract that stacks the two panes on phones and keeps them side by side from md up.
  it("stacks the category list above the editor on phones and puts them side by side from md", async () => {
    vi.mocked(listSettings).mockResolvedValue([setting(true)]);

    render(<AdminSettingsPage />);
    await screen.findByRole("button", { name: "Deactivate" });

    const nav = screen.getByRole("navigation");
    const row = nav.parentElement!;
    const editor = nav.nextElementSibling!;
    const tokens = (element: Element) => element.className.split(/\s+/);

    expect(tokens(row)).toEqual(expect.arrayContaining(["flex", "flex-col", "md:flex-row"]));
    expect(tokens(nav)).toEqual(expect.arrayContaining(["w-full", "md:w-64", "md:shrink-0"]));
    expect(tokens(nav)).not.toContain("w-64");
    expect(tokens(nav)).not.toContain("shrink-0");
    expect(tokens(editor)).toEqual(expect.arrayContaining(["min-w-0", "md:flex-1"]));
  });
});
