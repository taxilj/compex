import type { Company } from "@/types";

export const mockCompany: Company = {
  id: "cust-1",
  name: "TechCorp Industries Pvt. Ltd.",
  gstin: "27AABCT1234H1Z5",
  pan: "AABCT1234H",
  contactPerson: "Rahul Sharma",
  email: "procurement@techcorp.in",
  phone: "+91 98765 43210",
  website: "www.techcorp.in",
  tier: "enterprise",
  billingAddress: {
    line1: "Plot 45, MIDC Industrial Area",
    line2: "Phase 2",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411019",
    country: "India",
  },
  shippingAddress: {
    line1: "Unit 7, Electronic City Phase 2",
    city: "Bangalore",
    state: "Karnataka",
    pincode: "560100",
    country: "India",
  },
  users: [
    { id: "u1", name: "Rahul Sharma", email: "rahul@techcorp.in", role: "admin", initials: "RS" },
    { id: "u2", name: "Priya Nair", email: "priya@techcorp.in", role: "buyer", initials: "PN" },
    { id: "u3", name: "Amit Patel", email: "amit@techcorp.in", role: "viewer", initials: "AP" },
  ],
};
