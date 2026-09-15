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
});
