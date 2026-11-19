import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Page0 from "@/app/admin/orders/page";
import Page1 from "@/app/admin/purchase-orders/page";
import Page2 from "@/app/admin/invoices/page";
import Page3 from "@/app/admin/shipments/page";
import Page4 from "@/app/portal/orders/page";
import Page5 from "@/app/portal/orders/[id]/page";
import Page6 from "@/app/portal/invoices/page";
import Page7 from "@/app/portal/invoices/[id]/page";
import Page8 from "@/app/portal/shipments/page";
import Page9 from "@/app/portal/shipments/[id]/page";

describe("unfinished commercial workflows", () => {
  it.each([
    ["admin/orders", Page0, "Sales Orders", "/admin"],
    ["admin/purchase-orders", Page1, "Purchase Orders", "/admin"],
    ["admin/invoices", Page2, "Invoices", "/admin"],
    ["admin/shipments", Page3, "Shipments", "/admin"],
    ["portal/orders", Page4, "My Orders", "/portal"],
    ["portal/orders/[id]", Page5, "Order Details", "/portal"],
    ["portal/invoices", Page6, "Invoices", "/portal"],
    ["portal/invoices/[id]", Page7, "Invoice Details", "/portal"],
    ["portal/shipments", Page8, "Shipments", "/portal"],
    ["portal/shipments/[id]", Page9, "Shipment Details", "/portal"],
  ])(
    "%s shows an honest unavailable state without fetching records",
    (_route, Page, title, dashboard) => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      render(<Page />);
      expect(
        screen.getByRole("heading", { level: 1, name: title }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Please contact Compex for these documents."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Contact Compex" }),
      ).toHaveAttribute("href", "/contact");
      expect(
        screen.getByRole("link", { name: "Back to dashboard" }),
      ).toHaveAttribute("href", dashboard);
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    },
  );
});
