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
  const adminPassword = await bcrypt.hash("Admin@Compex2026!", 12);

  await prisma.user.upsert({
    where: { email: "admin@compexsolution.com" },
    update: {},
    create: {
      email: "admin@compexsolution.com",
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      firstName: "System",
      lastName: "Admin",
    },
  });

  await seedSettings();

  console.log("Seed complete. Admin: admin@compexsolution.com / Admin@Compex2026!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());