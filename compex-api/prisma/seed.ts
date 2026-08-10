import { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

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

  console.log("Seed complete. Admin: admin@compexsolution.com / Admin@Compex2026!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());