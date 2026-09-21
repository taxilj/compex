import { describe, expect, it } from "vitest";
import { ContactEntry } from "../../src/modules/admin/contact.schemas.js";

const ownerContact = {
  name: "Primary Contact",
  shortName: "PC",
  email: "primary@example.test",
  phone: "+91-22-40000000",
  mobile: "+91-9000000000",
  status: "ACTIVE",
  division: "Procurement",
  position: "Buyer",
  remarks: "Handles RFQ approvals",
};

describe("KAS CRM contact fields", () => {
  it("accepts the complete owner-defined customer contact shape", () => {
    expect(ContactEntry.parse(ownerContact)).toEqual(ownerContact);
  });

  it("retains the legacy role alias for existing clients", () => {
    expect(ContactEntry.parse({ name: "Legacy", role: "Buyer" })).toEqual({ name: "Legacy", role: "Buyer" });
  });

  it("rejects malformed contact email instead of storing unusable data", () => {
    expect(() => ContactEntry.parse({ name: "Bad", email: "not-an-email" })).toThrow();
  });
});
