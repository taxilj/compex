import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/errors.js";
import { audit } from "../../lib/audit.js";
import type { UpdateCompanyInput } from "./customers.schema.js";

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
      customer: {
        select: {
          id: true,
          accountNumber: true,
          companyId: true,
        },
      },
    },
  });
  if (!user) throw Errors.notFound("User");
  return user;
}

export async function getMyCompany(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, gstin: true, city: true, address: true },
  });
  if (!company) throw Errors.notFound("Company");
  return company;
}

export async function updateMyCompany(
  companyId: string,
  userId: string,
  input: UpdateCompanyInput,
) {
  const old = await prisma.company.findUnique({ where: { id: companyId } });
  if (!old) throw Errors.notFound("Company");

  const updated = await prisma.company.update({
    where: { id: companyId },
    data: input,
    select: { id: true, name: true, gstin: true, city: true, address: true },
  });

  audit({
    userId,
    action: "company.updated",
    entityType: "company",
    entityId: companyId,
    oldValue: old,
    newValue: updated,
  });

  return updated;
}