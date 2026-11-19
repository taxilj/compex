import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanDb, createAdminAndLogin, createTestApp } from "./helpers.js";
import { prisma } from "../../src/lib/prisma.js";

let app: FastifyInstance;
beforeAll(async () => { app = await createTestApp(); });
beforeEach(async () => { await cleanDb(); });
afterAll(async () => { await app.close(); await prisma.$disconnect(); });

describe.each(["customers", "vendors"] as const)("%s contact persistence", (resource) => {
  it("round-trips complete contacts and rejects invalid edits without losing saved data", async () => {
    const { accessToken } = await createAdminAndLogin(app, "contact-admin@invalid.test");
    const headers = { authorization: `Bearer ${accessToken}` };
    const contact = { name: "Primary Buyer", shortName: "PB", email: "buyer@invalid.test", phone: "12345678", mobile: "9876543210", status: "ACTIVE", division: "Procurement", position: "Buyer", remarks: "Synthetic contact", role: "Legacy buyer" };
    const payload = resource === "customers"
      ? { companyName: "Synthetic Contact Company", firstName: "Test", lastName: "Contact", email: "contact-customer@invalid.test", contacts: [contact] }
      : { name: "Synthetic Contact Vendor", contactEmail: "contact-vendor@invalid.test", contacts: [contact] };
    const created = await app.inject({ method: "POST", url: `/api/v1/admin/${resource}`, headers, payload });
    expect(created.statusCode).toBe(201);
    const url = `/api/v1/admin/${resource}/${created.json().data.id}`;
    const contacts = (body: ReturnType<typeof created.json>) => resource === "customers" ? body.data.company.contacts : body.data.contacts;
    expect(contacts((await app.inject({ method: "GET", url, headers })).json())).toEqual([contact]);
    const updated = { ...contact, position: "Sourcing", remarks: "Updated synthetic contact" };
    expect((await app.inject({ method: "PATCH", url, headers, payload: { contacts: [updated] } })).statusCode).toBe(200);
    const invalid = await app.inject({ method: "PATCH", url, headers, payload: { contacts: [{ name: " ", email: "invalid" }] } });
    expect(invalid.statusCode).toBe(400);
    expect(contacts((await app.inject({ method: "GET", url, headers })).json())).toEqual([updated]);
  });
});
