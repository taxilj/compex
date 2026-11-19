import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ContactForm from "./ContactForm";
import { submitPublicLead } from "@/lib/api/leads";
import { COMPANY_EMAIL, COMPANY_EMAIL_MAILTO_HREF, COMPANY_PHONE, COMPANY_PHONE_TEL_HREF } from "@/lib/constants/contact";

vi.mock("@/lib/api/leads", () => ({ submitPublicLead: vi.fn() }));

beforeEach(() => { vi.mocked(submitPublicLead).mockReset(); });

function filledForm() {
  render(<ContactForm />);
  fireEvent.change(screen.getByLabelText("Name *"), { target: { value: "Synthetic Buyer" } });
  fireEvent.change(screen.getByLabelText("Company *"), { target: { value: "Synthetic Company" } });
  fireEvent.change(screen.getByLabelText("Email *"), { target: { value: "buyer@invalid.test" } });
  fireEvent.change(screen.getByLabelText("Message *"), { target: { value: "Synthetic sourcing requirement" } });
  return screen.getByRole("button", { name: "Send Enquiry" }).closest("form")!;
}

describe("ContactForm submission", () => {
  it("ignores repeat form submissions while the first request is pending", async () => {
    let finish!: (value: Awaited<ReturnType<typeof submitPublicLead>>) => void;
    vi.mocked(submitPublicLead).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const form = filledForm();
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(submitPublicLead).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
    await act(async () => { finish({ id: "lead-1", referenceNumber: "ENQ-QA-001", source: "CONTACT" }); });
    expect(await screen.findByText("Enquiry Received")).toBeInTheDocument();
  });

  it("retains the enquiry and request key after failure and only confirms accepted data", async () => {
    vi.mocked(submitPublicLead).mockRejectedValueOnce(new Error("Private synthetic failure")).mockResolvedValueOnce({ id: "lead-1", referenceNumber: "ENQ-QA-002", source: "CONTACT" });
    const form = filledForm();
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).not.toHaveTextContent("Private synthetic failure");
    expect(screen.queryByText("Enquiry Received")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Message *")).toHaveValue("Synthetic sourcing requirement");
    const requestKey = vi.mocked(submitPublicLead).mock.calls[0][1];
    fireEvent.submit(form);
    expect(await screen.findByText("ENQ-QA-002")).toBeInTheDocument();
    expect(vi.mocked(submitPublicLead).mock.calls[1][1]).toBe(requestKey);
    expect(submitPublicLead).toHaveBeenLastCalledWith(expect.objectContaining({ source: "CONTACT", contactEmail: "buyer@invalid.test", message: "Synthetic sourcing requirement" }), requestKey);
  });
});

describe("ContactForm info panel", () => {
  it("makes the published phone and email clickable from the shared constants", () => {
    render(<ContactForm />);
    expect(screen.getByRole("link", { name: COMPANY_PHONE })).toHaveAttribute("href", COMPANY_PHONE_TEL_HREF);
    expect(screen.getByRole("link", { name: COMPANY_EMAIL })).toHaveAttribute("href", COMPANY_EMAIL_MAILTO_HREF);
  });
});
