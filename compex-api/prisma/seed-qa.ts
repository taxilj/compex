import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole, UserStatus } from "@prisma/client";

const prisma = new PrismaClient();

function isDedicatedTestDatabase(url?: string): boolean {
  if (!url) return false;
  try {
    return /_test$/i.test(new URL(url).pathname.replace(/^\//, ""));
  } catch {
    return false;
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} outside source control before QA seeding.`);
  return value;
}

async function main() {
  if (process.env.NODE_ENV !== "test" || process.env.ALLOW_QA_SEED !== "true" || !isDedicatedTestDatabase(process.env.DATABASE_URL)) {
    throw new Error("Refusing QA seed. Require NODE_ENV=test, ALLOW_QA_SEED=true, and a dedicated *_test database.");
  }

  const adminEmail = required("QA_ADMIN_EMAIL");
  const adminPassword = required("QA_ADMIN_PASSWORD");
  const customerEmail = required("QA_CUSTOMER_EMAIL");
  const customerPassword = required("QA_CUSTOMER_PASSWORD");

  const manufacturer = await prisma.manufacturer.upsert({
    where: { slug: "compex-qa-components-manufacturer" },
    update: {},
    create: { name: "Compex QA Components Manufacturer", slug: "compex-qa-components-manufacturer" },
  });
  const category = await prisma.category.upsert({
    where: { name: "Compex QA Electronic Components" },
    update: {},
    create: { name: "Compex QA Electronic Components", description: "Synthetic QA category" },
  });
  await prisma.product.upsert({
    where: { mpn: "QA-MPN-001" },
    update: {},
    create: { mpn: "QA-MPN-001", normalizedMpn: "QAMPN001", description: "Synthetic QA product", manufacturerId: manufacturer.id, categoryId: category.id },
  });
  let vendor = await prisma.vendor.findFirst({ where: { contactEmail: "qa-vendor@invalid.test" }, select: { id: true } });
  if (!vendor) {
    vendor = await prisma.vendor.create({
      data: { name: "Compex QA Electronics Supplier", contactEmail: "qa-vendor@invalid.test", notes: "Synthetic QA vendor" },
      select: { id: true },
    });
  }
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    create: { email: adminEmail, passwordHash: await bcrypt.hash(adminPassword, 12), role: UserRole.ADMIN, status: UserStatus.ACTIVE, firstName: "Compex", lastName: "QA Admin" },
  });

  const customerUser = await prisma.user.upsert({
    where: { email: customerEmail },
    update: { status: UserStatus.ACTIVE },
    create: { email: customerEmail, passwordHash: await bcrypt.hash(customerPassword, 12), status: UserStatus.ACTIVE, firstName: "Compex", lastName: "QA Customer" },
  });
  const company = await prisma.company.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: {},
    create: { id: "00000000-0000-4000-8000-000000000001", name: "Compex QA Demo Company", city: "QA City" },
  });
  const customer = await prisma.customer.upsert({
    where: { userId: customerUser.id },
    update: { companyId: company.id },
    create: { userId: customerUser.id, companyId: company.id, accountNumber: `CX-QA-${crypto.randomUUID().slice(0, 8).toUpperCase()}` },
  });

  const rfq = await prisma.rfq.upsert({
    where: { rfqNumber: "RFQ-QA-SEED-001" },
    update: {},
    create: { rfqNumber: "RFQ-QA-SEED-001", customerId: customer.id, status: "SUBMITTED", deliveryLocation: "QA City", additionalNotes: "Synthetic QA RFQ" },
  });
  let rfqItem = await prisma.rfqItem.findFirst({ where: { rfqId: rfq.id, lineNumber: 1 } });
  if (!rfqItem) {
    rfqItem = await prisma.rfqItem.create({ data: { rfqId: rfq.id, lineNumber: 1, mpn: "QA-MPN-001", manufacturer: manufacturer.name, description: "Synthetic QA product", quantity: 10 } });
  }
  const vendorRfq = await prisma.vendorRfq.upsert({
    where: { vendorRfqNumber: "VRFQ-QA-SEED-001" },
    update: { status: "SENT" },
    create: {
      vendorRfqNumber: "VRFQ-QA-SEED-001",
      rfqId: rfq.id,
      vendorId: vendor.id,
      status: "SENT",
      notes: "Synthetic QA vendor RFQ",
    },
  });
  const vendorRfqItem = await prisma.vendorRfqItem.findFirst({ where: { vendorRfqId: vendorRfq.id, rfqItemId: rfqItem.id }, select: { id: true } });
  if (!vendorRfqItem) {
    await prisma.vendorRfqItem.create({ data: { vendorRfqId: vendorRfq.id, rfqItemId: rfqItem.id, quantity: 10, notes: "Synthetic QA vendor RFQ item" } });
  }
  const vendorQuote = await prisma.vendorQuote.findFirst({ where: { vendorRfqId: vendorRfq.id, rfqItemId: rfqItem.id }, select: { id: true } });
  if (!vendorQuote) {
    await prisma.vendorQuote.create({
      data: {
        vendorRfqId: vendorRfq.id,
        rfqItemId: rfqItem.id,
        status: "RECEIVED",
        unitCost: 75,
        currency: "USD",
        leadTimeDays: 14,
        moq: 10,
        notes: "Synthetic QA vendor quote",
      },
    });
  }
  const existingQuotation = await prisma.quotation.findUnique({ where: { quotationNumber: "Q-QA-SEED-001" }, select: { id: true } });
  if (!existingQuotation) {
    await prisma.quotation.create({
      data: {
        quotationNumber: "Q-QA-SEED-001",
        rfqId: rfq.id,
        customerId: customer.id,
        status: "SENT",
        currency: "INR",
        subtotal: 1000,
        tax: 180,
        total: 1180,
        validUntil: new Date("2099-12-31T00:00:00.000Z"),
        notes: "Synthetic QA quotation",
        items: { create: { lineNumber: 1, rfqItemId: rfqItem.id, mpn: "QA-MPN-001", manufacturer: manufacturer.name, description: "Synthetic QA product", quantity: 10, unitPrice: 100, taxRate: 18, taxAmount: 180, lineTotal: 1180 } },
      },
    });
  }
}

main().finally(() => prisma.$disconnect());
