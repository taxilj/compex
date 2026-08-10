import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/errors.js";
import { audit } from "../../lib/audit.js";
import { nextRfqNumber } from "./rfq-number.js";
import type {
  CreateRfqInput,
  UpdateRfqInput,
  CreateRfqItemInput,
  UpdateRfqItemInput,
  RfqListQuery,
} from "./rfqs.schema.js";

const RFQ_SELECT = {
  id: true,
  rfqNumber: true,
  status: true,
  priority: true,
  deliveryLocation: true,
  requiredDate: true,
  additionalNotes: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
  customerId: true,
} as const;

// Verify ownership — returns 404 to prevent ID enumeration
async function assertOwnership(rfqId: string, customerId: string) {
  const rfq = await prisma.rfq.findUnique({ where: { id: rfqId } });
  if (!rfq || rfq.customerId !== customerId) throw Errors.notFound("RFQ");
  return rfq;
}

export async function createRfq(customerId: string, userId: string, input: CreateRfqInput) {
  const rfqNumber = await nextRfqNumber();

  const rfq = await prisma.rfq.create({
    data: {
      rfqNumber,
      customerId,
      deliveryLocation: input.deliveryLocation,
      requiredDate: input.requiredDate ? new Date(input.requiredDate) : undefined,
      priority: input.priority,
      additionalNotes: input.additionalNotes,
    },
    select: RFQ_SELECT,
  });

  audit({
    userId,
    customerId,
    action: "rfq.created",
    entityType: "rfq",
    entityId: rfq.id,
    newValue: { rfqNumber: rfq.rfqNumber },
  });

  return rfq;
}

export async function listRfqs(customerId: string, query: RfqListQuery) {
  const { status, page, limit } = query;
  const skip = (page - 1) * limit;

  const where = { customerId, ...(status ? { status } : {}) };
  const [data, total] = await prisma.$transaction([
    prisma.rfq.findMany({ where, select: RFQ_SELECT, skip, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.rfq.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function getRfq(rfqId: string, customerId: string) {
  const rfq = await prisma.rfq.findUnique({
    where: { id: rfqId },
    select: { ...RFQ_SELECT, items: true },
  });
  if (!rfq || rfq.customerId !== customerId) throw Errors.notFound("RFQ");
  return rfq;
}

export async function updateRfq(
  rfqId: string,
  customerId: string,
  userId: string,
  input: UpdateRfqInput,
) {
  const existing = await assertOwnership(rfqId, customerId);
  if (existing.status !== "DRAFT") {
    throw Errors.unprocessable("Only DRAFT RFQs can be edited");
  }

  const updated = await prisma.rfq.update({
    where: { id: rfqId },
    data: {
      deliveryLocation: input.deliveryLocation,
      requiredDate: input.requiredDate ? new Date(input.requiredDate) : undefined,
      priority: input.priority,
      additionalNotes: input.additionalNotes,
    },
    select: RFQ_SELECT,
  });

  audit({ userId, customerId, action: "rfq.updated", entityType: "rfq", entityId: rfqId });
  return updated;
}

export async function submitRfq(rfqId: string, customerId: string, userId: string) {
  const existing = await assertOwnership(rfqId, customerId);
  if (existing.status !== "DRAFT") {
    throw Errors.unprocessable("Only DRAFT RFQs can be submitted");
  }

  const itemCount = await prisma.rfqItem.count({ where: { rfqId } });
  if (itemCount === 0) {
    throw Errors.unprocessable("Add at least one item before submitting");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const rfq = await tx.rfq.update({
      where: { id: rfqId },
      data: { status: "SUBMITTED", submittedAt: new Date() },
      select: RFQ_SELECT,
    });
    await tx.auditLog.create({
      data: {
        userId,
        customerId,
        action: "rfq.submitted",
        entityType: "rfq",
        entityId: rfqId,
        oldValue: { status: "DRAFT" },
        newValue: { status: "SUBMITTED" },
      },
    });
    return rfq;
  });

  return updated;
}

export async function addItem(
  rfqId: string,
  customerId: string,
  userId: string,
  input: CreateRfqItemInput,
) {
  const rfq = await assertOwnership(rfqId, customerId);
  if (rfq.status !== "DRAFT") throw Errors.unprocessable("Items can only be added to DRAFT RFQs");

  const lineNumber =
    (await prisma.rfqItem.count({ where: { rfqId } })) + 1;

  return prisma.rfqItem.create({
    data: {
      rfqId,
      lineNumber,
      mpn: input.mpn,
      manufacturer: input.manufacturer,
      description: input.description,
      quantity: input.quantity,
      targetPriceUsd: input.targetPriceUsd != null ? new Decimal(input.targetPriceUsd) : undefined,
      requiredDate: input.requiredDate ? new Date(input.requiredDate) : undefined,
      notes: input.notes,
    },
  });
}

export async function updateItem(
  rfqId: string,
  itemId: string,
  customerId: string,
  input: UpdateRfqItemInput,
) {
  const rfq = await assertOwnership(rfqId, customerId);
  if (rfq.status !== "DRAFT") throw Errors.unprocessable("Items can only be edited on DRAFT RFQs");

  const item = await prisma.rfqItem.findFirst({ where: { id: itemId, rfqId } });
  if (!item) throw Errors.notFound("RFQ item");

  return prisma.rfqItem.update({
    where: { id: itemId },
    data: {
      mpn: input.mpn,
      manufacturer: input.manufacturer,
      description: input.description,
      quantity: input.quantity,
      targetPriceUsd: input.targetPriceUsd != null ? new Decimal(input.targetPriceUsd) : undefined,
      requiredDate: input.requiredDate ? new Date(input.requiredDate) : undefined,
      notes: input.notes,
    },
  });
}

export async function deleteItem(rfqId: string, itemId: string, customerId: string) {
  const rfq = await assertOwnership(rfqId, customerId);
  if (rfq.status !== "DRAFT") throw Errors.unprocessable("Items can only be removed from DRAFT RFQs");

  const item = await prisma.rfqItem.findFirst({ where: { id: itemId, rfqId } });
  if (!item) throw Errors.notFound("RFQ item");

  await prisma.rfqItem.delete({ where: { id: itemId } });
}