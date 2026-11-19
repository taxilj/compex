import { describe, expect, it } from "vitest";
import { ContactEntry } from "../../src/modules/admin/contact.schemas.js";

describe("owner contact fields", () => {
  it("retains complete contact records and the legacy role", () => {
    const contact = { name: "Primary Contact", shortName: "PC", email: "primary@invalid.test", phone: "12345678", mobile: "9876543210", status: "ACTIVE", division: "Procurement", position: "Buyer", remarks: "RFQ contact", role: "Legacy buyer" };
    expect(ContactEntry.parse(contact)).toEqual(contact);
  });
  it("rejects invalid email and missing names", () => {
    expect(ContactEntry.safeParse({ name: "Bad", email: "invalid" }).success).toBe(false);
    expect(ContactEntry.safeParse({ name: " ", mobile: "123" }).success).toBe(false);
  });
});
