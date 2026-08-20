import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const email = "arjun@demoelectronics.in";
const password = "Demo@12345!";

async function main() {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log("User already exists:", email);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const accountNumber = `CX-${Date.now().toString(36).toUpperCase()}`;

  const company = await db.company.create({
    data: { name: "Demo Electronics Pvt Ltd", city: "Mumbai" },
  });

  const user = await db.user.create({
    data: {
      email,
      passwordHash,
      firstName: "Arjun",
      lastName: "Mehta",
      phone: "9876543210",
      status: "ACTIVE",
    },
  });

  await db.customer.create({
    data: {
      userId: user.id,
      companyId: company.id,
      accountNumber,
    },
  });

  console.log("✓ Company:", company.name, `(${company.id})`);
  console.log("✓ User:", user.email, `(${user.id})`);
  console.log("✓ Account:", accountNumber);
  console.log("\nTest credentials:");
  console.log("  Email:   ", email);
  console.log("  Password:", password);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
