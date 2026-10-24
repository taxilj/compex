import { StrictMode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import ManufacturersGrid from "./ManufacturersGrid";
import { ApiError } from "@/lib/api/client";
import { listManufacturers } from "@/lib/api/manufacturers";

vi.mock("@/lib/api/manufacturers", () => ({ listManufacturers: vi.fn() }));
const mfr = (id: string, name: string) => ({ id, name, slug: id, logoUrl: null, website: null, description: null, country: null, _count: { products: 1 } });
const page1 = Array.from({ length: 100 }, (_, i) => mfr(`m${i}`, `Mfr ${String(i).padStart(3, "0")}`));
beforeEach(() => { vi.mocked(listManufacturers).mockReset(); });

describe("ManufacturersGrid bounded pagination", () => {
  it("fetches one bounded page under StrictMode and only advances on Next, with no truncation of total", async () => {
    vi.mocked(listManufacturers).mockResolvedValueOnce({ data: page1, total: 3682, page: 1, limit: 100 });
    render(<StrictMode><ManufacturersGrid /></StrictMode>);
    expect(await screen.findByText("Mfr 099")).toBeInTheDocument();
    expect(listManufacturers).toHaveBeenCalledTimes(1);
    expect(listManufacturers).toHaveBeenLastCalledWith({ page: 1, limit: 100, q: "" });
    expect(screen.getByRole("status")).toHaveTextContent("Page 1 of 37");
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    vi.mocked(listManufacturers).mockResolvedValueOnce({ data: [mfr("last", "Last Mfr")], total: 3682, page: 2, limit: 100 });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Last Mfr")).toBeInTheDocument();
    expect(screen.queryByText("Mfr 000")).not.toBeInTheDocument();
    expect(listManufacturers).toHaveBeenCalledTimes(2);
    expect(listManufacturers).toHaveBeenLastCalledWith({ page: 2, limit: 100, q: "" });
  });

  it("retains the failed page on Retry and never replaces a timeout with an empty catalogue", async () => {
    vi.mocked(listManufacturers).mockResolvedValueOnce({ data: page1, total: 101, page: 1, limit: 100 });
    render(<ManufacturersGrid />);
    await screen.findByText("Mfr 000");
    vi.mocked(listManufacturers).mockRejectedValueOnce(new ApiError(0, "TIMEOUT", "The server took too long to respond"));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load manufacturers");
    expect(screen.queryByText("No manufacturers in the catalogue yet")).not.toBeInTheDocument();
    vi.mocked(listManufacturers).mockResolvedValueOnce({ data: [mfr("last", "Last Mfr")], total: 101, page: 2, limit: 100 });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Last Mfr")).toBeInTheDocument();
    expect(listManufacturers).toHaveBeenLastCalledWith({ page: 2, limit: 100, q: "" });
    expect(screen.getByRole("status")).toHaveTextContent("Page 2 of 2");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("searches the entire server catalogue on submit, resets the page, and keeps search usable for zero matches", async () => {
    vi.mocked(listManufacturers).mockResolvedValueOnce({ data: page1, total: 3682, page: 1, limit: 100 });
    render(<ManufacturersGrid />);
    await screen.findByText("Mfr 000");
    fireEvent.change(screen.getByRole("textbox", { name: "Search manufacturers" }), { target: { value: "  Last Manufacturer  " } });
    expect(listManufacturers).toHaveBeenCalledTimes(1);
    vi.mocked(listManufacturers).mockResolvedValueOnce({ data: [], total: 0, page: 1, limit: 100 });
    fireEvent.click(screen.getByRole("button", { name: /^Search$/ }));
    expect(await screen.findByText("No manufacturers match your search.")).toBeInTheDocument();
    expect(listManufacturers).toHaveBeenLastCalledWith({ page: 1, limit: 100, q: "Last Manufacturer" });
    expect(screen.getByRole("textbox", { name: "Search manufacturers" })).toBeInTheDocument();
  });

  it("ignores a stale response after a newer search settles", async () => {
    vi.mocked(listManufacturers).mockResolvedValueOnce({ data: page1, total: 3682, page: 1, limit: 100 });
    render(<ManufacturersGrid />);
    await screen.findByText("Mfr 000");
    let finishOld!: (value: Awaited<ReturnType<typeof listManufacturers>>) => void;
    vi.mocked(listManufacturers).mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search manufacturers" }), { target: { value: "Old" } });
    fireEvent.click(screen.getByRole("button", { name: /^Search$/ }));
    await waitFor(() => expect(listManufacturers).toHaveBeenCalledTimes(2));
    vi.mocked(listManufacturers).mockResolvedValueOnce({ data: [mfr("new", "Newest")], total: 1, page: 1, limit: 100 });
    fireEvent.change(screen.getByRole("textbox", { name: "Search manufacturers" }), { target: { value: "New" } });
    fireEvent.click(screen.getByRole("button", { name: /^Search$/ }));
    await screen.findByText("Newest");
    await act(async () => { finishOld({ data: [mfr("old", "Outdated")], total: 1, page: 1, limit: 100 }); });
    expect(screen.queryByText("Outdated")).not.toBeInTheDocument();
    expect(screen.getByText("Newest")).toBeInTheDocument();
  });

  it("shows a genuine empty catalogue only for a successful unfiltered zero result", async () => {
    vi.mocked(listManufacturers).mockResolvedValueOnce({ data: [], total: 0, page: 1, limit: 100 });
    render(<ManufacturersGrid />);
    expect(await screen.findByText("No manufacturers in the catalogue yet")).toBeInTheDocument();
  });
});
