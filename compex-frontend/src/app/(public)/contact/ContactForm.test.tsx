import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ContactForm from "./ContactForm";
import { COMPANY_EMAIL, COMPANY_EMAIL_MAILTO_HREF, COMPANY_PHONE, COMPANY_PHONE_TEL_HREF } from "@/lib/constants/contact";

vi.mock("@/lib/api/leads", () => ({ submitPublicLead: vi.fn() }));

describe("ContactForm info panel", () => {
  it("makes the published phone and email clickable from the shared constants", () => {
    render(<ContactForm />);
    expect(screen.getByRole("link", { name: COMPANY_PHONE })).toHaveAttribute("href", COMPANY_PHONE_TEL_HREF);
    expect(screen.getByRole("link", { name: COMPANY_EMAIL })).toHaveAttribute("href", COMPANY_EMAIL_MAILTO_HREF);
  });
});
