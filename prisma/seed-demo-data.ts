import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { computeCart, round2, resolveLineTax } from "../lib/sales-calc";
import type { TaxableLine, DiscountInput } from "../lib/sales-calc";
import { buildReceiptNumber, placeholderReceiptNumber } from "../lib/receipt-number";

/**
 * Additive DEMO/DEV data generator — separate from prisma/seed.ts on purpose (see
 * package.json's db:seed vs db:seed-demo). A fresh install only needs seed.ts's minimal
 * bootstrap (location/register/roles/admin/tax classes/payment methods); this script piles
 * realistic bulk retail data on top so the dashboard/reports/UI have something to show.
 *
 * Every monetary/stock calculation below reuses the SAME pure functions the real app uses
 * (lib/sales-calc.ts's computeCart/resolveLineTax/round2, lib/receipt-number.ts's
 * buildReceiptNumber) and replicates the exact ledger+balance write discipline established in
 * app/actions/sales.ts (completeSale), app/actions/returns.ts (completeReturn),
 * app/actions/purchase-orders.ts (receivePurchaseOrderLineItem), and lib/shift.ts
 * (getShiftSummary's expectedCash formula) — so lib/reports.ts's queries produce numbers
 * indistinguishable from what those Server Actions would have produced. This is a raw
 * direct-to-DB script (no request/session context available), so Server Actions themselves
 * are never called — only their data shape + arithmetic is mirrored.
 */

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!, {});
const prisma = new PrismaClient({ adapter });

const LOCATION_ID = 1;
const REGISTER_ID = 1;

// ---------- small random helpers ----------

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomTimeOnDay(daysAgo: number, hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, randomInt(0, 59), 0);
  return d;
}

// ---------- static demo data ----------

const CATEGORY_DEFS = [
  { name: "Beverages", existingId: 1 as number | null },
  { name: "Snacks", existingId: null },
  { name: "Dairy", existingId: null },
  { name: "Bakery", existingId: null },
  { name: "Household", existingId: null },
  { name: "Personal Care", existingId: null },
  { name: "Frozen Foods", existingId: null },
  { name: "Canned Goods", existingId: null },
  { name: "Confectionery", existingId: null },
] as const;

interface ProductDef {
  sku: string;
  barcode: string;
  name: string;
  category: string;
  cost: number;
  sell: number;
  reorderThreshold: number;
  exempt?: boolean;
  variant?: { name: string; sku: string; barcode: string; priceOverride: number; unitsPerParent: number };
}

let barcodeCounter = 4800000000001;
function nextBarcode(): string {
  return String(barcodeCounter++);
}

const PRODUCT_DEFS: ProductDef[] = [
  // Beverages (BEV-001 "Cola 330ml" already exists in category Beverages)
  { sku: "BEV-002", barcode: nextBarcode(), name: "Sprite 330ml", category: "Beverages", cost: 15, sell: 20, reorderThreshold: 24,
    variant: { name: "Case of 24", sku: "BEV-002-C24", barcode: nextBarcode(), priceOverride: 440, unitsPerParent: 24 } },
  { sku: "BEV-003", barcode: nextBarcode(), name: "Royal Orange 330ml", category: "Beverages", cost: 14, sell: 18, reorderThreshold: 24,
    variant: { name: "Case of 24", sku: "BEV-003-C24", barcode: nextBarcode(), priceOverride: 396, unitsPerParent: 24 } },
  { sku: "BEV-004", barcode: nextBarcode(), name: "Bottled Water 500ml", category: "Beverages", cost: 8, sell: 12, reorderThreshold: 30 },
  { sku: "BEV-005", barcode: nextBarcode(), name: "C2 Green Tea 500ml", category: "Beverages", cost: 18, sell: 25, reorderThreshold: 20 },
  { sku: "BEV-006", barcode: nextBarcode(), name: "Kopiko Brown Coffee 3-in-1 (10s)", category: "Beverages", cost: 30, sell: 42, reorderThreshold: 15 },

  // Snacks
  { sku: "SNK-001", barcode: nextBarcode(), name: "Piattos Cheese 85g", category: "Snacks", cost: 20, sell: 28, reorderThreshold: 20,
    variant: { name: "Case of 12", sku: "SNK-001-C12", barcode: nextBarcode(), priceOverride: 312, unitsPerParent: 12 } },
  { sku: "SNK-002", barcode: nextBarcode(), name: "Nova Multigrain Chips 78g", category: "Snacks", cost: 18, sell: 25, reorderThreshold: 20 },
  { sku: "SNK-003", barcode: nextBarcode(), name: "Chippy BBQ 110g", category: "Snacks", cost: 22, sell: 30, reorderThreshold: 20,
    variant: { name: "Case of 12", sku: "SNK-003-C12", barcode: nextBarcode(), priceOverride: 336, unitsPerParent: 12 } },
  { sku: "SNK-004", barcode: nextBarcode(), name: "Clover Chips Barbecue 100g", category: "Snacks", cost: 15, sell: 20, reorderThreshold: 20 },
  { sku: "SNK-005", barcode: nextBarcode(), name: "Boy Bawang Cornick 100g", category: "Snacks", cost: 16, sell: 22, reorderThreshold: 20 },
  { sku: "SNK-006", barcode: nextBarcode(), name: "Oishi Prawn Crackers 60g", category: "Snacks", cost: 10, sell: 15, reorderThreshold: 25 },

  // Dairy
  { sku: "DRY-001", barcode: nextBarcode(), name: "Alaska Evaporated Milk 370ml", category: "Dairy", cost: 28, sell: 38, reorderThreshold: 20,
    variant: { name: "Case of 24", sku: "DRY-001-C24", barcode: nextBarcode(), priceOverride: 864, unitsPerParent: 24 } },
  { sku: "DRY-002", barcode: nextBarcode(), name: "Bear Brand Powdered Milk 320g", category: "Dairy", cost: 110, sell: 145, reorderThreshold: 12 },
  { sku: "DRY-003", barcode: nextBarcode(), name: "Eden Cheese 165g", category: "Dairy", cost: 55, sell: 72, reorderThreshold: 15 },
  { sku: "DRY-004", barcode: nextBarcode(), name: "Nestle Fresh Milk 1L", category: "Dairy", cost: 85, sell: 110, reorderThreshold: 10, exempt: true },
  { sku: "DRY-005", barcode: nextBarcode(), name: "Anchor Butter 227g", category: "Dairy", cost: 140, sell: 175, reorderThreshold: 10 },
  { sku: "DRY-006", barcode: nextBarcode(), name: "Magnolia Yogurt Drink 750ml", category: "Dairy", cost: 65, sell: 85, reorderThreshold: 10 },

  // Bakery
  { sku: "BKY-001", barcode: nextBarcode(), name: "Gardenia Classic White Bread", category: "Bakery", cost: 55, sell: 72, reorderThreshold: 10, exempt: true },
  { sku: "BKY-002", barcode: nextBarcode(), name: "Pandesal (pack of 10)", category: "Bakery", cost: 25, sell: 35, reorderThreshold: 15, exempt: true },
  { sku: "BKY-003", barcode: nextBarcode(), name: "Ensaymada (pack of 4)", category: "Bakery", cost: 60, sell: 80, reorderThreshold: 10, exempt: true },
  { sku: "BKY-004", barcode: nextBarcode(), name: "Rebisco Crackers (10s)", category: "Bakery", cost: 30, sell: 42, reorderThreshold: 15,
    variant: { name: "Case of 20", sku: "BKY-004-C20", barcode: nextBarcode(), priceOverride: 780, unitsPerParent: 20 } },
  { sku: "BKY-005", barcode: nextBarcode(), name: "SkyFlakes Crackers (10s)", category: "Bakery", cost: 32, sell: 45, reorderThreshold: 15 },

  // Household
  { sku: "HHD-001", barcode: nextBarcode(), name: "Tide Powder Detergent 1kg", category: "Household", cost: 85, sell: 110, reorderThreshold: 10 },
  { sku: "HHD-002", barcode: nextBarcode(), name: "Joy Dishwashing Liquid 495ml", category: "Household", cost: 45, sell: 62, reorderThreshold: 15,
    variant: { name: "Case of 12", sku: "HHD-002-C12", barcode: nextBarcode(), priceOverride: 700, unitsPerParent: 12 } },
  { sku: "HHD-003", barcode: nextBarcode(), name: "Zonrox Bleach 1L", category: "Household", cost: 35, sell: 48, reorderThreshold: 12 },
  { sku: "HHD-004", barcode: nextBarcode(), name: "Surf Fabric Conditioner 800ml", category: "Household", cost: 70, sell: 92, reorderThreshold: 10 },
  { sku: "HHD-005", barcode: nextBarcode(), name: "Trash Bags Large (pack of 10)", category: "Household", cost: 40, sell: 55, reorderThreshold: 15 },
  { sku: "HHD-006", barcode: nextBarcode(), name: "Scotch-Brite Sponge (pack of 3)", category: "Household", cost: 38, sell: 52, reorderThreshold: 15 },

  // Personal Care
  { sku: "PCR-001", barcode: nextBarcode(), name: "Safeguard Bar Soap 130g", category: "Personal Care", cost: 25, sell: 35, reorderThreshold: 20 },
  { sku: "PCR-002", barcode: nextBarcode(), name: "Head & Shoulders Shampoo 170ml", category: "Personal Care", cost: 95, sell: 125, reorderThreshold: 10 },
  { sku: "PCR-003", barcode: nextBarcode(), name: "Colgate Toothpaste 150g", category: "Personal Care", cost: 55, sell: 72, reorderThreshold: 15 },
  { sku: "PCR-004", barcode: nextBarcode(), name: "Palmolive Body Wash 200ml", category: "Personal Care", cost: 65, sell: 85, reorderThreshold: 10 },
  { sku: "PCR-005", barcode: nextBarcode(), name: "Rexona Deodorant Roll-on 50ml", category: "Personal Care", cost: 70, sell: 92, reorderThreshold: 10 },
  { sku: "PCR-006", barcode: nextBarcode(), name: "Johnson's Baby Powder 200g", category: "Personal Care", cost: 80, sell: 105, reorderThreshold: 10 },

  // Frozen Foods
  { sku: "FRZ-001", barcode: nextBarcode(), name: "Purefoods Chicken Nuggets 500g", category: "Frozen Foods", cost: 130, sell: 170, reorderThreshold: 10 },
  { sku: "FRZ-002", barcode: nextBarcode(), name: "CDO Beef Tapa 500g", category: "Frozen Foods", cost: 150, sell: 195, reorderThreshold: 10 },
  { sku: "FRZ-003", barcode: nextBarcode(), name: "Marina Squid Balls 500g", category: "Frozen Foods", cost: 110, sell: 145, reorderThreshold: 10 },
  { sku: "FRZ-004", barcode: nextBarcode(), name: "Magnolia Ice Cream 1.3L", category: "Frozen Foods", cost: 180, sell: 230, reorderThreshold: 8 },
  { sku: "FRZ-005", barcode: nextBarcode(), name: "Swift Hotdog Classic 500g", category: "Frozen Foods", cost: 120, sell: 155, reorderThreshold: 10 },

  // Canned Goods
  { sku: "CAN-001", barcode: nextBarcode(), name: "555 Sardines in Tomato Sauce 155g", category: "Canned Goods", cost: 15, sell: 22, reorderThreshold: 25,
    variant: { name: "Case of 48", sku: "CAN-001-C48", barcode: nextBarcode(), priceOverride: 1008, unitsPerParent: 48 } },
  { sku: "CAN-002", barcode: nextBarcode(), name: "Century Tuna Flakes in Oil 180g", category: "Canned Goods", cost: 35, sell: 48, reorderThreshold: 20,
    variant: { name: "Case of 48", sku: "CAN-002-C48", barcode: nextBarcode(), priceOverride: 2208, unitsPerParent: 48 } },
  { sku: "CAN-003", barcode: nextBarcode(), name: "Argentina Corned Beef 150g", category: "Canned Goods", cost: 55, sell: 72, reorderThreshold: 15 },
  { sku: "CAN-004", barcode: nextBarcode(), name: "Del Monte Fruit Cocktail 432g", category: "Canned Goods", cost: 60, sell: 80, reorderThreshold: 12 },
  { sku: "CAN-005", barcode: nextBarcode(), name: "Ligo Sardines Spanish Style 155g", category: "Canned Goods", cost: 16, sell: 23, reorderThreshold: 20 },

  // Confectionery
  { sku: "CNF-001", barcode: nextBarcode(), name: "Cloud 9 Chocolate Bar", category: "Confectionery", cost: 12, sell: 18, reorderThreshold: 25 },
  { sku: "CNF-002", barcode: nextBarcode(), name: "Choc Nut (pack of 10)", category: "Confectionery", cost: 25, sell: 35, reorderThreshold: 15 },
  { sku: "CNF-003", barcode: nextBarcode(), name: "Mentos Mint Roll", category: "Confectionery", cost: 10, sell: 15, reorderThreshold: 25 },
  { sku: "CNF-004", barcode: nextBarcode(), name: "Nips Candy (pack)", category: "Confectionery", cost: 8, sell: 12, reorderThreshold: 25 },
  { sku: "CNF-005", barcode: nextBarcode(), name: "Storck Mini Mints", category: "Confectionery", cost: 15, sell: 22, reorderThreshold: 20 },
];

interface CompositeDef {
  sku: string;
  barcode: string;
  name: string;
  category: string;
  components: { sku: string; quantity: number }[];
}

const COMPOSITE_DEFS: CompositeDef[] = [
  {
    sku: "CMB-001",
    barcode: nextBarcode(),
    name: "Breakfast Combo Pack",
    category: "Bakery",
    components: [
      { sku: "BKY-001", quantity: 1 },
      { sku: "DRY-005", quantity: 1 },
      { sku: "BEV-006", quantity: 2 },
    ],
  },
  {
    sku: "CMB-002",
    barcode: nextBarcode(),
    name: "Cleaning Bundle Pack",
    category: "Household",
    components: [
      { sku: "HHD-002", quantity: 1 },
      { sku: "HHD-006", quantity: 1 },
      { sku: "HHD-003", quantity: 1 },
    ],
  },
  {
    sku: "CMB-003",
    barcode: nextBarcode(),
    name: "Movie Night Snack Pack",
    category: "Snacks",
    components: [
      { sku: "SNK-003", quantity: 1 },
      { sku: "BEV-002", quantity: 2 },
      { sku: "CNF-001", quantity: 1 },
    ],
  },
];

const SUPPLIER_DEFS = [
  { name: "Metro Grocery Supply Inc.", contactInfo: "metro.supply@example.ph / 0917-555-0101", paymentTerms: "Net 15" },
  { name: "Golden Harvest Distributors", contactInfo: "sales@goldenharvest.example.ph / 0918-555-0102", paymentTerms: "Net 30" },
  { name: "Prime Foods Trading Corp.", contactInfo: "orders@primefoods.example.ph / 0919-555-0103", paymentTerms: "Net 45" },
  { name: "Unity Household Products Inc.", contactInfo: "unity.hp@example.ph / 0920-555-0104", paymentTerms: "COD" },
  { name: "Sunrise Beverage Co.", contactInfo: "sunrise.bev@example.ph / 0921-555-0105", paymentTerms: "Net 30" },
];

const CUSTOMER_GROUP_DEFS = [
  { name: "Regular", discountPercentage: 0 },
  { name: "VIP", discountPercentage: 10 },
  { name: "Wholesale", discountPercentage: 15 },
];

const CUSTOMER_DEFS = [
  { name: "Maria Clara Santos", phone: "09175551001", email: "maria.santos@example.com" },
  { name: "Jose Rizal Garcia", phone: "09175551002", email: "jose.garcia@example.com" },
  { name: "Andres Bonifacio Reyes", phone: "09175551003", email: null },
  { name: "Gabriela Silang Cruz", phone: "09175551004", email: "gabriela.cruz@example.com" },
  { name: "Emilio Aguinaldo Tan", phone: "09175551005", email: null },
  { name: "Melchora Aquino Lim", phone: "09175551006", email: "melchora.lim@example.com" },
  { name: "Apolinario Mabini Yu", phone: "09175551007", email: null },
  { name: "Corazon Aquino Ramos", phone: "09175551008", email: "corazon.ramos@example.com" },
  { name: "Ramon Magsaysay Ong", phone: "09175551009", email: null },
  { name: "Lea Salonga Bautista", phone: "09175551010", email: "lea.bautista@example.com" },
  { name: "Manny Pacquiao Villanueva", phone: "09175551011", email: null },
  { name: "Vico Sotto Mendoza", phone: "09175551012", email: "vico.mendoza@example.com" },
  { name: "Kris Aquino Fernandez", phone: "09175551013", email: null },
  { name: "Angel Locsin Torres", phone: "09175551014", email: "angel.torres@example.com" },
  { name: "Coco Martin Aguilar", phone: "09175551015", email: null },
  { name: "Anne Curtis Navarro", phone: "09175551016", email: "anne.navarro@example.com" },
  { name: "Vice Ganda Flores", phone: "09175551017", email: null },
  { name: "Piolo Pascual Castillo", phone: "09175551018", email: "piolo.castillo@example.com" },
  { name: "Sarah Geronimo Domingo", phone: "09175551019", email: null },
  { name: "Bamboo Manalac Rivera", phone: "09175551020", email: "bamboo.rivera@example.com" },
  { name: "Regine Velasquez Morales", phone: "09175551021", email: null },
  { name: "Gary Valenciano Ramirez", phone: "09175551022", email: "gary.ramirez@example.com" },
];

const DISCOUNT_DEFS = [
  { name: "Senior Citizen / PWD Discount", type: "PERCENTAGE" as const, value: 20, appliesTo: "CART" as const },
  { name: "Employee Discount", type: "PERCENTAGE" as const, value: 15, appliesTo: "CART" as const },
  { name: "Weekend Flash Sale", type: "FIXED" as const, value: 50, appliesTo: "CART" as const },
];

// ---------- main ----------

async function main() {
  console.log("Starting demo data seed...");

  // ---------- 1. Categories ----------
  const categoryIdByName = new Map<string, number>();
  for (const def of CATEGORY_DEFS) {
    if (def.existingId) {
      categoryIdByName.set(def.name, def.existingId);
      continue;
    }
    const existing = await prisma.category.findFirst({ where: { name: def.name } });
    if (existing) {
      categoryIdByName.set(def.name, existing.id);
    } else {
      const created = await prisma.category.create({ data: { name: def.name } });
      categoryIdByName.set(def.name, created.id);
    }
  }
  console.log(`Categories ready: ${categoryIdByName.size}`);

  // ---------- 2. Tax classes (reuse existing) ----------
  const taxClasses = await prisma.taxClass.findMany();
  const standardTax = taxClasses.find((t) => t.name === "Standard") ?? taxClasses[0];
  const exemptTax = taxClasses.find((t) => t.name === "Exempt") ?? standardTax;
  const taxClassById = new Map(taxClasses.map((t) => [t.id, { ratePercentage: Number(t.ratePercentage), isInclusive: t.isInclusive }]));
  const defaultTax = { ratePercentage: Number(standardTax.ratePercentage), isInclusive: standardTax.isInclusive };

  // ---------- 3. Products + variants ----------
  const productIdBySku = new Map<string, number>();
  const productMeta = new Map<
    number,
    { sku: string; sellPrice: number; costPrice: number; taxClassId: number; trackStock: boolean; reorderThreshold: number }
  >();
  const variantIdBySku = new Map<string, number>();
  const variantMeta = new Map<number, { productId: number; priceOverride: number; unitsPerParent: number }>();

  for (const def of PRODUCT_DEFS) {
    const taxClassId = def.exempt ? exemptTax.id : standardTax.id;
    const product = await prisma.product.upsert({
      where: { sku: def.sku },
      update: {},
      create: {
        sku: def.sku,
        barcode: def.barcode,
        name: def.name,
        categoryId: categoryIdByName.get(def.category)!,
        taxClassId,
        costPrice: def.cost,
        sellPrice: def.sell,
        imageUrl: `https://picsum.photos/seed/${def.sku.toLowerCase()}/300`,
        reorderThreshold: def.reorderThreshold,
        trackStock: true,
      },
    });
    productIdBySku.set(def.sku, product.id);
    productMeta.set(product.id, {
      sku: def.sku,
      sellPrice: def.sell,
      costPrice: def.cost,
      taxClassId: product.taxClassId ?? standardTax.id,
      trackStock: product.trackStock,
      reorderThreshold: product.reorderThreshold,
    });

    if (def.variant) {
      const variant = await prisma.productVariant.upsert({
        where: { sku: def.variant.sku },
        update: {},
        create: {
          productId: product.id,
          name: def.variant.name,
          sku: def.variant.sku,
          barcode: def.variant.barcode,
          priceOverride: def.variant.priceOverride,
          unitsPerParent: def.variant.unitsPerParent,
        },
      });
      variantIdBySku.set(def.variant.sku, variant.id);
      variantMeta.set(variant.id, {
        productId: product.id,
        priceOverride: def.variant.priceOverride,
        unitsPerParent: def.variant.unitsPerParent,
      });
    }
  }
  console.log(`Products ready: ${productMeta.size}`);

  // ---------- 3b. Composite products ----------
  for (const def of COMPOSITE_DEFS) {
    // Compute bundle cost/sell from actual component defs (cost/sell are known statically above).
    const compCostSell = def.components.reduce(
      (acc, c) => {
        const compDef = PRODUCT_DEFS.find((p) => p.sku === c.sku)!;
        acc.cost += compDef.cost * c.quantity;
        acc.sell += compDef.sell * c.quantity;
        return acc;
      },
      { cost: 0, sell: 0 },
    );
    const bundleSell = round2(compCostSell.sell * 0.92); // small bundle discount vs buying separately

    const product = await prisma.product.upsert({
      where: { sku: def.sku },
      update: {},
      create: {
        sku: def.sku,
        barcode: def.barcode,
        name: def.name,
        categoryId: categoryIdByName.get(def.category)!,
        taxClassId: standardTax.id,
        costPrice: round2(compCostSell.cost),
        sellPrice: bundleSell,
        imageUrl: `https://picsum.photos/seed/${def.sku.toLowerCase()}/300`,
        reorderThreshold: 0,
        trackStock: false, // components carry their own stock; bundle itself isn't tracked (matches completeSale's trackStock-gated stock logic — no composite-decomposition exists yet)
        isComposite: true,
      },
    });
    productIdBySku.set(def.sku, product.id);
    productMeta.set(product.id, {
      sku: def.sku,
      sellPrice: bundleSell,
      costPrice: round2(compCostSell.cost),
      taxClassId: standardTax.id,
      trackStock: false,
      reorderThreshold: 0,
    });

    for (const c of def.components) {
      const componentId = productIdBySku.get(c.sku)!;
      const existingComponent = await prisma.productComponent.findFirst({
        where: { parentId: product.id, componentId },
      });
      if (!existingComponent) {
        await prisma.productComponent.create({
          data: { parentId: product.id, componentId, quantity: c.quantity },
        });
      }
    }
  }
  console.log(`Composite products ready: ${COMPOSITE_DEFS.length}`);

  // ---------- 4. Suppliers ----------
  const supplierIds: number[] = [];
  for (const def of SUPPLIER_DEFS) {
    const existing = await prisma.supplier.findFirst({ where: { name: def.name } });
    if (existing) {
      supplierIds.push(existing.id);
    } else {
      const created = await prisma.supplier.create({ data: def });
      supplierIds.push(created.id);
    }
  }
  console.log(`Suppliers ready: ${supplierIds.length}`);

  // ---------- 5. Customer groups ----------
  const groupIdByName = new Map<string, number>();
  for (const def of CUSTOMER_GROUP_DEFS) {
    const existing = await prisma.customerGroup.findFirst({ where: { name: def.name } });
    if (existing) {
      groupIdByName.set(def.name, existing.id);
    } else {
      const created = await prisma.customerGroup.create({ data: def });
      groupIdByName.set(def.name, created.id);
    }
  }
  const groupCycle = ["Regular", "Regular", "Regular", "VIP", "Regular", "Wholesale"];

  // ---------- 6. Customers ----------
  await prisma.customer.createMany({
    data: CUSTOMER_DEFS.map((c, i) => ({
      name: c.name,
      phone: c.phone,
      email: c.email,
      customerGroupId: groupIdByName.get(groupCycle[i % groupCycle.length])!,
    })),
    skipDuplicates: true,
  });
  const allCustomers = await prisma.customer.findMany({ select: { id: true, storeCreditBalance: true } });
  const customerIds = allCustomers.map((c) => c.id);
  console.log(`Customers in DB: ${allCustomers.length}`);

  // ---------- 7. Discounts ----------
  const allDiscounts: { id: number; type: "PERCENTAGE" | "FIXED"; value: number }[] = [];
  for (const def of DISCOUNT_DEFS) {
    const existing = await prisma.discount.findFirst({ where: { name: def.name } });
    if (existing) {
      allDiscounts.push({ id: existing.id, type: existing.type as "PERCENTAGE" | "FIXED", value: Number(existing.value) });
    } else {
      const created = await prisma.discount.create({
        data: { name: def.name, type: def.type, value: def.value, appliesTo: def.appliesTo, active: true },
      });
      allDiscounts.push({ id: created.id, type: def.type, value: def.value });
    }
  }
  const existingLoyalty = await prisma.discount.findFirst({ where: { name: "Loyalty 10%" } });
  if (existingLoyalty) {
    allDiscounts.push({ id: existingLoyalty.id, type: existingLoyalty.type as "PERCENTAGE" | "FIXED", value: Number(existingLoyalty.value) });
  }
  console.log(`Discounts ready: ${allDiscounts.length}`);

  // ---------- 8. Initial inventory (only for trackStock products, i.e. non-composite) ----------
  const inventoryKeys: { productId: number; variantId: number | null }[] = [];
  for (const [productId, meta] of productMeta) {
    if (!meta.trackStock) continue;
    inventoryKeys.push({ productId, variantId: null });
  }
  for (const [variantId, vmeta] of variantMeta) {
    inventoryKeys.push({ productId: vmeta.productId, variantId });
  }

  // Prisma's compound-unique "where" input doesn't accept null for the nullable variantId
  // column (see app/actions/sales.ts etc — they all use findFirst + create/update instead of
  // upsert for this exact reason). Mirror that pattern here rather than fighting the type.
  const initialQtyByKey = new Map<string, number>();
  for (const k of inventoryKeys) {
    const key = `${k.productId}_${k.variantId ?? "base"}`;
    const initialQty = k.variantId ? randomInt(10, 60) : randomInt(80, 400);
    initialQtyByKey.set(key, initialQty);
    const existing = await prisma.inventory.findFirst({
      where: { locationId: LOCATION_ID, productId: k.productId, variantId: k.variantId },
      select: { id: true },
    });
    if (!existing) {
      await prisma.inventory.create({
        data: { locationId: LOCATION_ID, productId: k.productId, variantId: k.variantId, quantityOnHand: initialQty },
      });
    }
  }
  console.log(`Inventory rows seeded (initial): ${inventoryKeys.length}`);

  // Net delta accumulator applied at the very end (fewer round trips than updating per-event).
  const inventoryDelta = new Map<string, number>();
  function addDelta(productId: number, variantId: number | null, delta: number) {
    const key = `${productId}_${variantId ?? "base"}`;
    inventoryDelta.set(key, (inventoryDelta.get(key) ?? 0) + delta);
  }

  // ---------- 9. Purchase orders ----------
  const existingPoCount = await prisma.purchaseOrder.count();
  const poLines: { sku: string; qty: number; cost: number }[][] = [
    [{ sku: "SNK-001", qty: 50, cost: 20 }, { sku: "SNK-002", qty: 40, cost: 18 }],
    [{ sku: "BKY-001", qty: 30, cost: 55 }, { sku: "BKY-002", qty: 40, cost: 25 }],
    [{ sku: "FRZ-002", qty: 30, cost: 150 }, { sku: "FRZ-001", qty: 40, cost: 130 }],
    [{ sku: "BEV-002", qty: 100, cost: 15 }, { sku: "BEV-003", qty: 80, cost: 14 }, { sku: "BEV-004", qty: 120, cost: 8 }],
  ];
  const poStatuses: ("DRAFT" | "ORDERED" | "PARTIAL" | "RECEIVED")[] = ["DRAFT", "ORDERED", "PARTIAL", "RECEIVED"];
  const poDaysAgo = [20, 15, 12, 8];
  const adminUser = await prisma.user.findUnique({ where: { email: "admin@possystem.local" } });
  if (!adminUser) throw new Error("Admin user not found — run `npm run db:seed` first");

  if (existingPoCount < 4) {
    for (let i = 0; i < poStatuses.length; i++) {
      const status = poStatuses[i];
      const createdAt = randomTimeOnDay(poDaysAgo[i], 10, 0);
      const supplierId = supplierIds[i % supplierIds.length];
      const expectedDate = new Date(createdAt);
      expectedDate.setDate(expectedDate.getDate() + 7);

      const po = await prisma.purchaseOrder.create({
        data: { supplierId, locationId: LOCATION_ID, status: "DRAFT", expectedDate, createdAt },
      });

      const lines = poLines[i];
      const createdLines = [];
      for (const l of lines) {
        const productId = productIdBySku.get(l.sku)!;
        const line = await prisma.purchaseOrderLineItem.create({
          data: { purchaseOrderId: po.id, productId, quantityOrdered: l.qty, unitCost: l.cost, quantityReceived: 0 },
        });
        createdLines.push({ ...line, sku: l.sku, qty: l.qty });
      }

      if (status === "DRAFT") {
        // leave as-is
      } else if (status === "ORDERED") {
        await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: "ORDERED" } });
      } else if (status === "PARTIAL" || status === "RECEIVED") {
        await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: "ORDERED" } });
        const receiveFraction = status === "PARTIAL" ? 0.5 : 1;
        const receivedAt = randomTimeOnDay(poDaysAgo[i] - 3, 14, 0);
        for (const line of createdLines) {
          const receiveQty = status === "PARTIAL" ? Math.floor(line.qty * receiveFraction) : line.qty;
          if (receiveQty <= 0) continue;
          await prisma.purchaseOrderLineItem.update({
            where: { id: line.id },
            data: { quantityReceived: { increment: receiveQty } },
          });
          const productId = productIdBySku.get(line.sku)!;
          await prisma.stockMovement.create({
            data: {
              locationId: LOCATION_ID,
              productId,
              variantId: null,
              quantityDelta: receiveQty,
              reason: "RECEIVING",
              referenceId: po.id,
              createdById: adminUser.id,
              createdAt: receivedAt,
            },
          });
          addDelta(productId, null, receiveQty);
        }
        const finalStatus = status === "PARTIAL" ? "PARTIAL" : "RECEIVED";
        await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: finalStatus } });
      }
    }
    console.log(`Purchase orders created: ${poStatuses.length}`);
  } else {
    console.log("Purchase orders already present — skipping PO generation");
  }

  // ---------- 10. Shifts + Sales (the bulk of the demo data) ----------
  const existingCompletedSales = await prisma.sale.count({ where: { status: "COMPLETED" } });
  const cashierPool = [adminUser];
  const mariaUser = await prisma.user.findUnique({ where: { email: "maria@possystem.local" } });
  if (mariaUser) cashierPool.push(mariaUser);

  const paymentMethods = await prisma.paymentMethod.findMany();
  const cashMethod = paymentMethods.find((p) => p.name === "Cash")!;
  const gcashMethod = paymentMethods.find((p) => p.name === "GCash")!;
  const cardMethod = paymentMethods.find((p) => p.name === "Card")!;

  const sellableProductIds = [...productMeta.entries()].filter(([, m]) => m.trackStock).map(([id]) => id);
  const productsWithVariants = [...variantMeta.entries()]; // [variantId, {productId, priceOverride, unitsPerParent}]

  const loyaltyDelta = new Map<number, number>();
  let totalSalesCreated = 0;
  let totalShiftsCreated = 0;

  if (existingCompletedSales < 100) {
    const DAYS = 30;
    for (let daysAgo = DAYS - 1; daysAgo >= 0; daysAgo--) {
      // ~15% of days the store simply had no shift (closed / no data entered that day).
      if (Math.random() < 0.15) continue;

      const cashier = cashierPool[daysAgo % cashierPool.length];
      const openedAt = randomTimeOnDay(daysAgo, 8, 0);
      const openingFloat = 3000;

      const shift = await prisma.shift.create({
        data: {
          registerId: REGISTER_ID,
          locationId: LOCATION_ID,
          cashierId: cashier.id,
          openingFloat,
          openedAt,
        },
      });
      totalShiftsCreated++;

      const baseCount = randomInt(3, 8);
      const recencyBonus = daysAgo <= 7 ? randomInt(3, 8) : daysAgo <= 14 ? randomInt(1, 4) : 0;
      const salesCount = baseCount + recencyBonus;

      let dayCashTotal = 0;

      for (let s = 0; s < salesCount; s++) {
        const hour = randomInt(8, 20);
        const minute = randomInt(0, 59);
        const saleTime = randomTimeOnDay(daysAgo, hour, minute);

        const numLines = randomInt(1, 4);
        const chosenProductIds = shuffle(sellableProductIds).slice(0, numLines);

        const lines: TaxableLine[] = chosenProductIds.map((productId, idx) => {
          const meta = productMeta.get(productId)!;
          const variantEntry = productsWithVariants.find(([, v]) => v.productId === productId);
          const useVariant = variantEntry && Math.random() < 0.15;
          const tax = resolveLineTax(taxClassById.get(meta.taxClassId), defaultTax);
          const quantity = useVariant ? randomInt(1, 3) : randomInt(1, 5);
          const unitPrice = useVariant ? variantEntry![1].priceOverride : meta.sellPrice;
          return {
            key: `${productId}_${useVariant ? variantEntry![0] : "base"}_${idx}`,
            productId,
            variantId: useVariant ? variantEntry![0] : null,
            sku: meta.sku,
            name: meta.sku,
            unitPrice,
            quantity,
            taxRatePercentage: tax.taxRatePercentage,
            taxIsInclusive: tax.taxIsInclusive,
            trackStock: meta.trackStock,
          };
        });

        let discount: DiscountInput = null;
        if (Math.random() < 0.15 && allDiscounts.length > 0) {
          const d = pick(allDiscounts);
          discount = { type: d.type, value: d.value };
        }

        const computed = computeCart(lines, discount);
        if (computed.grandTotal <= 0) continue;

        const customerId = Math.random() < 0.4 ? pick(customerIds) : null;

        // Payment method mix: 60% cash, 30% gcash, 10% card; ~10% chance of a cash+second split.
        const methodRoll = Math.random();
        const primaryMethod = methodRoll < 0.6 ? cashMethod : methodRoll < 0.9 ? gcashMethod : cardMethod;
        const payments: { paymentMethodId: number; amount: number; tenderedAmount: number | null; changeGiven: number | null; referenceNumber: string | null }[] = [];

        const splitPayment = Math.random() < 0.1 && computed.grandTotal > 50;
        if (splitPayment) {
          const secondMethod = primaryMethod.id === cashMethod.id ? gcashMethod : cashMethod;
          const secondAmount = round2(computed.grandTotal * (0.3 + Math.random() * 0.3));
          const firstAmount = round2(computed.grandTotal - secondAmount);
          payments.push(buildPayment(primaryMethod.id, firstAmount, primaryMethod.id === cashMethod.id));
          payments.push(buildPayment(secondMethod.id, secondAmount, secondMethod.id === cashMethod.id));
        } else {
          payments.push(buildPayment(primaryMethod.id, computed.grandTotal, primaryMethod.id === cashMethod.id));
        }

        for (const p of payments) {
          if (p.paymentMethodId === cashMethod.id) dayCashTotal += p.amount;
        }

        const created = await prisma.sale.create({
          data: {
            receiptNumber: placeholderReceiptNumber(),
            locationId: LOCATION_ID,
            registerId: REGISTER_ID,
            cashierId: cashier.id,
            customerId,
            shiftId: shift.id,
            status: "COMPLETED",
            createdAt: saleTime,
            completedAt: saleTime,
            subtotal: computed.subtotal,
            discountTotal: computed.discountTotal,
            taxTotal: computed.taxTotal,
            grandTotal: computed.grandTotal,
          },
        });
        const receiptNumber = buildReceiptNumber(LOCATION_ID, REGISTER_ID, created.id);
        await prisma.sale.update({ where: { id: created.id }, data: { receiptNumber } });

        await prisma.saleLineItem.createMany({
          data: computed.lines.map((l) => ({
            saleId: created.id,
            productId: l.productId,
            variantId: l.variantId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discountAmount: l.discountAmount,
            taxAmount: l.taxAmount,
            lineTotal: l.lineTotal,
          })),
        });

        await prisma.payment.createMany({
          data: payments.map((p) => ({
            saleId: created.id,
            paymentMethodId: p.paymentMethodId,
            amount: p.amount,
            tenderedAmount: p.tenderedAmount,
            changeGiven: p.changeGiven,
            referenceNumber: p.referenceNumber,
          })),
        });

        const stockMoveRows = computed.lines.filter((l) => l.trackStock);
        if (stockMoveRows.length > 0) {
          await prisma.stockMovement.createMany({
            data: stockMoveRows.map((l) => ({
              locationId: LOCATION_ID,
              productId: l.productId,
              variantId: l.variantId,
              quantityDelta: -l.quantity,
              reason: "SALE" as const,
              referenceId: created.id,
              createdById: cashier.id,
              createdAt: saleTime,
            })),
          });
          for (const l of stockMoveRows) addDelta(l.productId, l.variantId, -l.quantity);
        }

        if (customerId) {
          const pointsEarned = Math.floor(computed.grandTotal / 10);
          if (pointsEarned > 0) {
            loyaltyDelta.set(customerId, (loyaltyDelta.get(customerId) ?? 0) + pointsEarned);
          }
        }

        totalSalesCreated++;
      }

      const closedAt = randomTimeOnDay(daysAgo, 20, 45);
      const expectedCash = round2(openingFloat + dayCashTotal);
      const variance = round2(randomInt(-50, 50));
      const closingCount = round2(expectedCash + variance);

      await prisma.shift.update({
        where: { id: shift.id },
        data: { closedAt, closingCount, expectedCash, variance },
      });
    }
    console.log(`Shifts created: ${totalShiftsCreated}, Sales created: ${totalSalesCreated}`);
  } else {
    console.log("Sales history already present (>=100 completed sales) — skipping bulk sales generation");
  }

  function buildPayment(paymentMethodId: number, amount: number, isCash: boolean) {
    if (isCash) {
      const tendered = round2(Math.ceil(amount / 50) * 50);
      return {
        paymentMethodId,
        amount,
        tenderedAmount: tendered,
        changeGiven: round2(tendered - amount),
        referenceNumber: null,
      };
    }
    return {
      paymentMethodId,
      amount,
      tenderedAmount: amount,
      changeGiven: 0,
      referenceNumber: `REF-${randomInt(100000, 999999)}`,
    };
  }

  // ---------- 11. Apply accumulated inventory deltas ----------
  for (const [key, delta] of inventoryDelta) {
    const [productIdStr, variantPart] = key.split("_");
    const productId = Number(productIdStr);
    const variantId = variantPart === "base" ? null : Number(variantPart);
    await prisma.inventory.updateMany({
      where: { locationId: LOCATION_ID, productId, variantId },
      data: { quantityOnHand: { increment: delta } },
    });
  }
  console.log(`Inventory deltas applied: ${inventoryDelta.size}`);

  // ---------- 12. Apply loyalty point accruals ----------
  for (const [customerId, points] of loyaltyDelta) {
    await prisma.customer.update({ where: { id: customerId }, data: { loyaltyPointsBalance: { increment: points } } });
  }
  console.log(`Customers with loyalty accrual: ${loyaltyDelta.size}`);

  // ---------- 13. Low-stock / out-of-stock demo overrides ----------
  const lowStockTargets: { sku: string; variantSku?: string; target: number }[] = [
    { sku: "FRZ-004", target: 0 },
    { sku: "DRY-005", target: 0 },
    { sku: "PCR-002", target: 3 },
    { sku: "CNF-004", target: 4 },
    { sku: "HHD-003", target: 5 },
    { sku: "BKY-005", target: 6 },
    { sku: "SNK-006", target: 8 },
    { sku: "CAN-004", target: 5 },
  ];
  for (const t of lowStockTargets) {
    const productId = productIdBySku.get(t.sku);
    if (!productId) continue;
    const inv = await prisma.inventory.findFirst({ where: { locationId: LOCATION_ID, productId, variantId: null } });
    if (!inv) continue;
    const current = inv.quantityOnHand.toNumber();
    const delta = t.target - current;
    if (delta === 0) continue;
    await prisma.stockMovement.create({
      data: {
        locationId: LOCATION_ID,
        productId,
        variantId: null,
        quantityDelta: delta,
        reason: "ADJUSTMENT",
        referenceId: null,
        createdById: adminUser.id,
      },
    });
    await prisma.inventory.update({ where: { id: inv.id }, data: { quantityOnHand: t.target } });
  }
  console.log(`Low-stock demo overrides applied: ${lowStockTargets.length}`);

  // ---------- 14. Returns ----------
  const existingReturnCount = await prisma.return.count();
  if (existingReturnCount < 8) {
    const candidateSales = await prisma.sale.findMany({
      where: { status: "COMPLETED" },
      include: { lineItems: true, customer: { select: { id: true } } },
      orderBy: { completedAt: "desc" },
      take: 60,
    });
    const shuffledCandidates = shuffle(candidateSales).slice(0, 10);

    let returnsCreated = 0;
    for (let i = 0; i < shuffledCandidates.length; i++) {
      const sale = shuffledCandidates[i];
      if (sale.lineItems.length === 0) continue;
      const line = pick(sale.lineItems);
      const quantity = line.quantity.toNumber();
      if (quantity <= 0) continue;
      const returnQty = Math.max(1, Math.floor(quantity * (0.3 + Math.random() * 0.6)));
      if (returnQty > quantity) continue;

      const lineTotal = line.lineTotal.toNumber();
      const refundForLine = round2((lineTotal / quantity) * returnQty);
      if (refundForLine <= 0) continue;

      const restocked = Math.random() < 0.75;
      const useStoreCredit = i < 3 && sale.customer;
      const refundMethod: "ORIGINAL_PAYMENT" | "CASH" | "STORE_CREDIT" = useStoreCredit
        ? "STORE_CREDIT"
        : Math.random() < 0.5
          ? "CASH"
          : "ORIGINAL_PAYMENT";

      const created = await prisma.return.create({
        data: {
          originalSaleId: sale.id,
          processedById: adminUser.id,
          reason: pick(["Customer changed mind", "Wrong item purchased", "Damaged packaging", "Duplicate purchase", "Expired near date"]),
          refundMethod,
          totalRefunded: refundForLine,
        },
      });

      await prisma.returnLineItem.create({
        data: { returnId: created.id, saleLineItemId: line.id, quantityReturned: returnQty, restocked },
      });

      if (restocked) {
        await prisma.stockMovement.create({
          data: {
            locationId: LOCATION_ID,
            productId: line.productId,
            variantId: line.variantId,
            quantityDelta: returnQty,
            reason: "RETURN",
            referenceId: created.id,
            createdById: adminUser.id,
          },
        });
        await prisma.inventory.updateMany({
          where: { locationId: LOCATION_ID, productId: line.productId, variantId: line.variantId },
          data: { quantityOnHand: { increment: returnQty } },
        });
      }

      const fullyReturned = round2(returnQty) >= round2(quantity);
      await prisma.sale.update({
        where: { id: sale.id },
        data: { status: fullyReturned ? "REFUNDED" : "PARTIALLY_REFUNDED" },
      });

      if (refundMethod === "STORE_CREDIT" && sale.customer) {
        await prisma.customer.update({
          where: { id: sale.customer.id },
          data: { storeCreditBalance: { increment: refundForLine } },
        });
      }

      returnsCreated++;
    }
    console.log(`Returns created: ${returnsCreated}`);
  } else {
    console.log("Returns already present — skipping return generation");
  }

  // ---------- Final counts ----------
  const [
    categoryCount,
    productCount,
    variantCount,
    componentCount,
    inventoryCount,
    supplierCount,
    poCount,
    customerGroupCount,
    customerCount,
    discountCount,
    shiftCount,
    saleCount,
    saleLineCount,
    paymentCount,
    stockMovementCount,
    returnCount,
  ] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.productComponent.count(),
    prisma.inventory.count(),
    prisma.supplier.count(),
    prisma.purchaseOrder.count(),
    prisma.customerGroup.count(),
    prisma.customer.count(),
    prisma.discount.count(),
    prisma.shift.count(),
    prisma.sale.count(),
    prisma.saleLineItem.count(),
    prisma.payment.count(),
    prisma.stockMovement.count(),
    prisma.return.count(),
  ]);

  console.log("\n=== Final row counts ===");
  console.table({
    categories: categoryCount,
    products: productCount,
    productVariants: variantCount,
    productComponents: componentCount,
    inventory: inventoryCount,
    suppliers: supplierCount,
    purchaseOrders: poCount,
    customerGroups: customerGroupCount,
    customers: customerCount,
    discounts: discountCount,
    shifts: shiftCount,
    sales: saleCount,
    saleLineItems: saleLineCount,
    payments: paymentCount,
    stockMovements: stockMovementCount,
    returns: returnCount,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
