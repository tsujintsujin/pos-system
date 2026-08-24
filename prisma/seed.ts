import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const location = await prisma.location.upsert({
    where: { id: 1 },
    update: {},
    create: { name: "Main Store", address: "" },
  });

  const register = await prisma.register.upsert({
    where: { id: 1 },
    update: {},
    create: { locationId: location.id, name: "Register 1" },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: {},
    create: {
      name: "ADMIN",
      canAccessBackOffice: true,
      canOverridePrice: true,
      canApproveRefund: true,
      canVoidAfterCompletion: true,
      canManageUsers: true,
      canManageSettings: true,
    },
  });

  await prisma.role.upsert({
    where: { name: "MANAGER" },
    update: {},
    create: {
      name: "MANAGER",
      canAccessBackOffice: true,
      canOverridePrice: true,
      canApproveRefund: true,
      canVoidAfterCompletion: true,
      canManageUsers: false,
      canManageSettings: false,
    },
  });

  await prisma.role.upsert({
    where: { name: "CASHIER" },
    update: {},
    create: {
      name: "CASHIER",
      canAccessBackOffice: false,
      canOverridePrice: false,
      canApproveRefund: false,
      canVoidAfterCompletion: false,
      canManageUsers: false,
      canManageSettings: false,
    },
  });

  const passwordHash = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@possystem.local" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@possystem.local",
      passwordHash,
      roleId: adminRole.id,
      locationId: location.id,
    },
  });

  await prisma.taxClass.upsert({
    where: { id: 1 },
    update: {},
    create: { name: "Standard", ratePercentage: 12, isInclusive: false },
  });

  // "Store Credit" is a real PaymentMethod row (not a schema field) so a store-credit
  // redemption at checkout can be recorded as an ordinary Payment line, same shape as
  // Cash/GCash/Card — see completeSale in app/actions/sales.ts, which looks this row up
  // by name and validates+decrements Customer.storeCreditBalance when it's used.
  for (const name of ["Cash", "GCash", "Card", "Store Credit"]) {
    await prisma.paymentMethod.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log("Seed complete:", { location: location.name, register: register.name });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
