import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminLeadsPage from "./page";
import type { AdminLead } from "@/lib/api/admin";

const api = vi.hoisted(() => ({
  listAdminLeads: vi.fn(),
  listCustomers: vi.fn(),
  convertLeadToRfq: vi.fn(),
}));

vi.mock("@/lib/api/admin", () => api);

function lead(overrides: Partial<AdminLead> = {}): AdminLead {
  return {
    id: "l1",
    referenceNumber: "ENQ-2026-000001",
    contactName: "Asha",
    contactEmail: "asha@example.test",
    contactPhone: null,
    companyName: "Example Co",
    source: "CONTACT",
    status: "NEW",
    priority: "MEDIUM",
    lastContactAt: null,
    nextFollowUpAt: null,
    notes: null,
    subject: null,
    deliveryLocation: null,
    requiredDate: null,
    notificationStatus: "SENT",
    notificationSentAt: null,
    notificationError: null,
    createdAt: "2026-10-19T08:00:00Z",
    rfq: null,
    items: [],
    assignedTo: null,
    ...overrides,
  };
}

function load(leads: AdminLead[]) {
  api.listAdminLeads.mockResolvedValue({ data: leads, total: leads.length, page: 1, limit: 50 });
  api.listCustomers.mockResolvedValue({ data: [], total: 0, page: 1, limit: 100 });
}

beforeEach(() => vi.clearAllMocks());

describe("admin enquiries notification status", () => {
  it("flags a failed notification with a red badge and a banner naming the count", async () => {
    load([
      lead({ id: "a", notificationStatus: "FAILED", notificationError: "Notification delivery failed" }),
      lead({ id: "b", referenceNumber: "ENQ-2026-000002", contactEmail: "b@example.test", notificationStatus: "SENT" }),
    ]);

    render(<AdminLeadsPage />);

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("1 enquiry could not be emailed to the sales mailbox");
    const failed = screen.getByText("Failed");
    expect(failed).toHaveAttribute("title", "Notification delivery failed");
    expect(screen.getByText("Sent")).toBeInTheDocument();
  });

  it("pluralises the banner for several failures", async () => {
    load([
      lead({ id: "a", notificationStatus: "FAILED" }),
      lead({ id: "b", referenceNumber: "ENQ-2026-000002", notificationStatus: "FAILED" }),
    ]);

    render(<AdminLeadsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("2 enquiries could not be emailed to the sales mailbox");
  });

  it("shows no banner when nothing failed, and tolerates a missing notification status", async () => {
    load([
      lead({ id: "a", notificationStatus: "PENDING" }),
      lead({ id: "b", referenceNumber: "ENQ-2026-000002", notificationStatus: null }),
    ]);

    render(<AdminLeadsPage />);

    expect(await screen.findByText("Pending")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
