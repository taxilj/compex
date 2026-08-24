import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma.js";

const email = process.env.ROTATE_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ROTATE_ADMIN_PASSWORD;

if (!email || !password) {
  throw new Error(
    "ROTATE_ADMIN_EMAIL and ROTATE_ADMIN_PASSWORD are required. Provide them only through a secure, ephemeral environment.",
  );
}

const admin = await prisma.user.findUnique({
  where: { email },
  select: { id: true, role: true },
});

if (!admin || admin.role !== UserRole.ADMIN) {
  throw new Error("The requested account does not exist or is not an admin account.");
}

const passwordHash = await bcrypt.hash(password, 12);

await prisma.$transaction([
  prisma.user.update({ where: { id: admin.id }, data: { passwordHash } }),
  prisma.refreshToken.deleteMany({ where: { userId: admin.id } }),
]);

console.log("Admin credential rotated and active refresh sessions revoked.");
await prisma.$disconnect();
