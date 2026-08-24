import { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import settingsLov from "./settings-lov-seed-data.json" with { type: "json" };

const prisma = new PrismaClient();

// Owner Excel "Settings" sheet, 25 LOV categories. Idempotent upsert — safe
// to re-run. See docs/OWNER-MASTER-DATA-COMPLIANCE.md.
async function seedSettings() {
  for (const [category, values] of Object.entries(settingsLov as Record<string, string[]>)) {
    for (let i = 0; i < values.length; i++) {
      await prisma.setting.upsert({
        where: { category_value: { category, value: values[i] } },
        update: {},
        create: { category, value: values[i], sortOrder: i },
      });
    }
  }
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  // An admin is optional seed data and must be supplied by the deployment
  // environment. Never make a reusable production credential part of the repo.
  if (adminEmail && adminPassword) {
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        firstName: "System",
        lastName: "Admin",
      },
    });
  } else if (adminEmail || adminPassword) {
    throw new Error("Set both SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD, or neither.");
  }

  await seedSettings();

  console.log("Seed complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
