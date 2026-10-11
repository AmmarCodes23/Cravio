import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { revalidateCatalog, revalidateCatalogForProducts } from "@/lib/catalog";
import {
  looksLikeRemoteUrl,
  resolveCategorySlug,
} from "@/lib/company-slug";
import { nextStoredImage } from "@/lib/product-image";

/**
 * POS sync endpoint: returns products, categories, companies, and optionally
 * vendors and orders for local SQLite mirroring.
 *
 * Optional header X-POS-API-Key: when set and matching POS_API_KEY env var,
 * includes vendors and orders (otherwise only products, categories, companies).
 */
export async function GET(request: Request) {
  try {
    const rawKey = request.headers.get("x-pos-api-key") ?? request.headers.get("X-POS-API-Key") ?? "";
    const apiKey = rawKey.trim();
    const expectedKey = (process.env.POS_API_KEY ?? "").trim();
    const includeProtected = expectedKey.length > 0 && apiKey === expectedKey;

    const [products, categories, companies, vendors, orders] = await Promise.all([
      prisma.product.findMany(),
      prisma.category.findMany({ orderBy: { name: "asc" } }),
      prisma.company.findMany({
        orderBy: { name: "asc" },
        include: { categories: { select: { name: true } } },
      }),
      includeProtected
        ? prisma.p2PVendor.findMany({ orderBy: { createdAt: "desc" } })
        : Promise.resolve([]),
      includeProtected
        ? prisma.order.findMany({
            orderBy: { createdAt: "desc" },
            include: {
              orderProducts: { include: { product: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const payload = {
      products,
      categories,
      companies: companies.map((c) => ({
        id: c.id,
        name: c.name,
        image: c.image,
        productCount: c.productCount,
        isHidden: c.isHidden,
        categories: c.categories.map((cat) => cat.name),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      vendors,
      orders,
    };

    const response = NextResponse.json(payload);
    response.headers.set("X-POS-Key-Used", includeProtected ? "true" : "false");
    return response;
  } catch (error) {
    console.error("POS sync error:", error);
    return NextResponse.json(
      { error: "Sync failed" },
      { status: 500 }
    );
  }
}

type NamedId = { id: number; name: string; localId?: number };
type FailedNamedId = NamedId & { error: string };

/**
 * Keep only fields whose value differs from the stored row. Returns null when
 * nothing changed so callers can skip the UPDATE (and the @updatedAt bump).
 */
function changedFields<T extends Record<string, unknown>>(
  existing: Record<string, unknown>,
  next: T
): T | null {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) continue;
    if ((value ?? null) !== (existing[key] ?? null)) out[key] = value;
  }
  return Object.keys(out).length ? (out as T) : null;
}

const WRITE_CONCURRENCY = 10;

async function runChunked<T>(items: T[], fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += WRITE_CONCURRENCY) {
    await Promise.all(items.slice(i, i + WRITE_CONCURRENCY).map(fn));
  }
}

type PushSaleItem = {
  productId?: number | null;
  name: string;
  unitPrice: number;
  discount: number;
  quantity: number;
  lineTotal: number;
};

type PushReceipt = {
  barcode: string;
  netTotal: number;
  grossTotal: number;
  discountTotal: number;
  saleType: string;
  createdAt: string;
};

type PushPurchaseItem = {
  productId?: number | null;
  name: string;
  unitCost: number;
  quantity: number;
  lineTotal: number;
};

/** Request body when pushing local POS data to cloud (Sync = reflect local to cloud). */
type PushSyncBody = {
  localSales?: Array<{
    id?: number;
    cloudId?: number | null;
    vendorId?: number | null;
    vendorName?: string | null;
    customerId?: number | null;
    customerName?: string | null;
    ledgerEntryId?: number | null;
    saleType: string;
    discountTotal: number;
    grossTotal: number;
    netTotal: number;
    cashPaid?: number;
    onlinePaid?: number;
    cashCollected?: number;
    changeGiven?: number;
    creditAmount?: number;
    createdAt: string;
    items: PushSaleItem[];
    receipt?: PushReceipt | null;
  }>;
  ledger?: Array<{
    id?: number;
    cloudId?: number | null;
    name: string;
    phoneNumber: string;
    address?: string | null;
    entryType: string;
    balance: number;
    due: boolean;
    createdAt: string;
  }>;
  localPurchases?: Array<{
    id?: number;
    cloudId?: number | null;
    vendorId?: number | null;
    vendorName?: string | null;
    ledgerEntryId?: number | null;
    totalAmount: number;
    cashPaid?: number;
    onlinePaid?: number;
    cashCollected?: number;
    changeGiven?: number;
    creditAmount?: number;
    createdAt: string;
    items: PushPurchaseItem[];
  }>;
  products?: Array<{
    id: number;
    name?: string;
    company?: string;
    companyId?: number | null;
    category?: string;
    categoryId?: number | null;
    price?: number;
    originalPrice?: number | null;
    retailPrice?: number;
    consumerPrice?: number;
    bulkPrice?: number;
    bulkLimit?: number | null;
    image?: string;
    description?: string | null;
    companyImage?: string;
    barcode?: string | null;
    costPrice?: number | null;
    profitMargin?: number | null;
    isHidden?: boolean;
  }>;
  categories?: Array<{
    id: number;
    name?: string;
    url?: string;
    image?: string | null;
    isHidden?: boolean;
  }>;
  companies?: Array<{
    id: number;
    name?: string;
    image?: string | null;
    isHidden?: boolean;
  }>;
};

/**
 * POST: Upsert local POS catalog, sales, purchases, and ledger to cloud.
 * Sales match by cloudId or receipt barcode so re-sync does not duplicate rows.
 * Requires X-POS-API-Key header.
 */
export async function POST(request: Request) {
  try {
    const rawKey = request.headers.get("x-pos-api-key") ?? request.headers.get("X-POS-API-Key") ?? "";
    const apiKey = rawKey.trim();
    const expectedKey = (process.env.POS_API_KEY ?? "").trim();
    if (expectedKey.length === 0 || apiKey !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as PushSyncBody;
    const localSales = body.localSales ?? [];
    const ledger = body.ledger ?? [];
    const localPurchases = body.localPurchases ?? [];
    const products = body.products ?? [];
    const categories = body.categories ?? [];
    const companies = body.companies ?? [];

    const productsUpdated: NamedId[] = [];
    const productsFailed: FailedNamedId[] = [];
    const categoriesUpdated: NamedId[] = [];
    const categoriesFailed: FailedNamedId[] = [];
    const companiesUpdated: NamedId[] = [];
    const companiesFailed: FailedNamedId[] = [];
    const ledgerCreated: NamedId[] = [];
    const ledgerFailed: FailedNamedId[] = [];
    const salesCreated: NamedId[] = [];
    const salesFailed: FailedNamedId[] = [];
    const purchasesCreated: NamedId[] = [];
    const purchasesFailed: FailedNamedId[] = [];

    // Catalog rows: the POS pushes its whole local mirror on every sale, so
    // batch the reads, diff against the cloud row, and only write real changes.
    // Unchanged rows must not be touched or @updatedAt churns every ISR page.

    // Pages to regenerate: only the category/company pages a changed row appears on.
    const touchedCategories: (string | null | undefined)[] = [];
    const touchedCompanies: (string | null | undefined)[] = [];

    // Categories first (products reference them by id/name)
    const existingCategories = new Map(
      (
        await prisma.category.findMany({
          where: { id: { in: categories.map((c) => c.id) } },
        })
      ).map((row) => [row.id, row])
    );
    const categoryWrites: Array<{ id: number; label: string; data: Prisma.CategoryUpdateInput }> = [];
    for (const c of categories) {
      const label = c.name?.trim() || `Category #${c.id}`;
      const existing = existingCategories.get(c.id);
      if (!existing) {
        categoriesFailed.push({ id: c.id, name: label, error: "Not found on cloud" });
        continue;
      }
      const name = c.name !== undefined ? String(c.name) : existing.name;
      const incomingUrl = c.url !== undefined ? String(c.url || "") : existing.url;
      const imageFromLegacyUrl = looksLikeRemoteUrl(incomingUrl)
        ? incomingUrl.trim()
        : looksLikeRemoteUrl(existing.url) && !existing.image
          ? existing.url
          : undefined;
      const nextImage = c.image !== undefined ? c.image : imageFromLegacyUrl;
      const data = changedFields(existing, {
        ...(c.name !== undefined ? { name } : {}),
        url: resolveCategorySlug(name, incomingUrl),
        ...(nextImage !== undefined
          ? { image: nextStoredImage(nextImage, existing.image) }
          : {}),
        ...(c.isHidden !== undefined ? { isHidden: Boolean(c.isHidden) } : {}),
      });
      if (data) categoryWrites.push({ id: c.id, label, data });
    }
    await runChunked(categoryWrites, async ({ id, label, data }) => {
      try {
        const updated = await prisma.category.update({ where: { id }, data });
        categoriesUpdated.push({ id: updated.id, name: updated.name });
        touchedCategories.push(existingCategories.get(id)?.name, updated.name);
      } catch (err) {
        categoriesFailed.push({
          id,
          name: label,
          error: err instanceof Error ? err.message : "Update failed",
        });
      }
    });

    const existingCompanies = new Map(
      (
        await prisma.company.findMany({
          where: { id: { in: companies.map((c) => c.id) } },
        })
      ).map((row) => [row.id, row])
    );
    const companyWrites: Array<{ id: number; label: string; data: Prisma.CompanyUpdateInput }> = [];
    for (const c of companies) {
      const label = c.name?.trim() || `Company #${c.id}`;
      const existing = existingCompanies.get(c.id);
      if (!existing) {
        companiesFailed.push({ id: c.id, name: label, error: "Not found on cloud" });
        continue;
      }
      const data = changedFields(existing, {
        ...(c.name !== undefined ? { name: String(c.name) } : {}),
        ...(c.image !== undefined ? { image: c.image } : {}),
        ...(c.isHidden !== undefined ? { isHidden: Boolean(c.isHidden) } : {}),
      });
      if (data) companyWrites.push({ id: c.id, label, data });
    }
    await runChunked(companyWrites, async ({ id, label, data }) => {
      try {
        const updated = await prisma.company.update({ where: { id }, data });
        companiesUpdated.push({ id: updated.id, name: updated.name });
        touchedCompanies.push(existingCompanies.get(id)?.name, updated.name);
      } catch (err) {
        companiesFailed.push({
          id,
          name: label,
          error: err instanceof Error ? err.message : "Update failed",
        });
      }
    });

    const existingProducts = new Map(
      (
        await prisma.product.findMany({
          where: { id: { in: products.map((p) => p.id) } },
        })
      ).map((row) => [row.id, row])
    );
    const incomingBarcodes = products
      .map((p) => (p.barcode == null ? "" : String(p.barcode).trim()))
      .filter(Boolean);
    const barcodeOwners = new Map(
      incomingBarcodes.length
        ? (
            await prisma.product.findMany({
              where: { barcode: { in: incomingBarcodes } },
              select: { id: true, name: true, barcode: true },
            })
          ).map((row) => [row.barcode as string, row])
        : []
    );
    const productWrites: Array<{ id: number; label: string; data: Prisma.ProductUpdateInput }> = [];
    for (const p of products) {
      const label = p.name?.trim() || `Product #${p.id}`;
      const existing = existingProducts.get(p.id);
      if (!existing) {
        productsFailed.push({ id: p.id, name: label, error: "Not found on cloud" });
        continue;
      }

      const nextBarcode =
        p.barcode === undefined
          ? undefined
          : p.barcode === null || String(p.barcode).trim() === ""
            ? null
            : String(p.barcode).trim();

      if (nextBarcode) {
        const clash = barcodeOwners.get(nextBarcode);
        if (clash && clash.id !== p.id) {
          productsFailed.push({
            id: p.id,
            name: label,
            error: `Barcode already on "${clash.name}" (id ${clash.id})`,
          });
          continue;
        }
      }

      const consumer =
        p.consumerPrice !== undefined && Number.isFinite(Number(p.consumerPrice))
          ? Number(p.consumerPrice)
          : undefined;
      const retail =
        p.retailPrice !== undefined && Number.isFinite(Number(p.retailPrice))
          ? Number(p.retailPrice)
          : undefined;

      const data = changedFields(existing, {
        ...(p.name !== undefined ? { name: String(p.name) } : {}),
        ...(p.company !== undefined ? { company: String(p.company) } : {}),
        ...(p.category !== undefined ? { category: String(p.category) } : {}),
        ...(p.companyId !== undefined ? { companyId: p.companyId } : {}),
        ...(p.categoryId !== undefined ? { categoryId: p.categoryId } : {}),
        ...(consumer !== undefined ? { consumerPrice: consumer, price: consumer } : {}),
        ...(retail !== undefined ? { retailPrice: retail, originalPrice: retail } : {}),
        ...(p.bulkPrice !== undefined && Number.isFinite(Number(p.bulkPrice))
          ? { bulkPrice: Number(p.bulkPrice) }
          : {}),
        ...(p.bulkLimit !== undefined ? { bulkLimit: p.bulkLimit } : {}),
        ...(p.image !== undefined
          ? { image: nextStoredImage(p.image, existing.image) }
          : {}),
        ...(p.description !== undefined ? { description: p.description } : {}),
        ...(p.companyImage !== undefined
          ? { companyImage: nextStoredImage(p.companyImage, existing.companyImage) }
          : {}),
        ...(nextBarcode !== undefined ? { barcode: nextBarcode } : {}),
        ...(p.costPrice !== undefined
          ? {
              costPrice:
                p.costPrice === null || Number.isNaN(Number(p.costPrice))
                  ? null
                  : Number(p.costPrice),
            }
          : {}),
        ...(p.profitMargin !== undefined ? { profitMargin: p.profitMargin } : {}),
        ...(p.isHidden !== undefined ? { isHidden: Boolean(p.isHidden) } : {}),
      });
      if (data) productWrites.push({ id: p.id, label, data });
    }
    await runChunked(productWrites, async ({ id, label, data }) => {
      try {
        const updated = await prisma.product.update({ where: { id }, data });
        productsUpdated.push({ id: updated.id, name: updated.name });
        const before = existingProducts.get(id);
        touchedCategories.push(before?.category, updated.category);
        touchedCompanies.push(before?.company, updated.company);
      } catch (err) {
        productsFailed.push({
          id,
          name: label,
          error: err instanceof Error ? err.message : "Update failed",
        });
      }
    });

    const ledgerIdMap = new Map<number, number>();
    for (const e of ledger) {
      const label = e.name?.trim() || `Ledger #${e.id ?? "?"}`;
      try {
        const data = {
          name: e.name,
          phoneNumber: e.phoneNumber,
          address: e.address ?? null,
          entryType: e.entryType ?? "RECEIVABLE",
          balance: e.balance ?? 0,
          due: e.due ?? true,
          createdAt: e.createdAt ? new Date(e.createdAt) : new Date(),
        };
        const existing = await findLedgerRow(e.cloudId, data);
        const row = existing
          ? await prisma.ledgerEntry.update({
              where: { id: existing.id },
              data: {
                name: data.name,
                phoneNumber: data.phoneNumber,
                address: data.address,
                entryType: data.entryType,
                balance: data.balance,
                due: data.due,
              },
            })
          : await prisma.ledgerEntry.create({ data });
        if (e.id != null) ledgerIdMap.set(e.id, row.id);
        ledgerCreated.push({ id: row.id, name: row.name, localId: e.id });
      } catch (err) {
        ledgerFailed.push({
          id: e.id ?? 0,
          name: label,
          localId: e.id,
          error: err instanceof Error ? err.message : "Upsert failed",
        });
      }
    }

    for (const s of localSales) {
      const saleLabel =
        s.customerName?.trim() ||
        s.vendorName?.trim() ||
        s.receipt?.barcode ||
        `Sale ${s.createdAt ?? s.id ?? ""}`;
      try {
        const cloudLedgerId =
          s.ledgerEntryId != null ? (ledgerIdMap.get(s.ledgerEntryId) ?? null) : null;
        const saleData = {
          vendorId: s.vendorId ?? null,
          vendorName: s.vendorName ?? null,
          customerId: s.customerId ?? null,
          customerName: s.customerName ?? null,
          ledgerEntryId: cloudLedgerId,
          saleType: s.saleType ?? "POS",
          discountTotal: s.discountTotal ?? 0,
          grossTotal: s.grossTotal ?? 0,
          netTotal: s.netTotal ?? 0,
          cashPaid: s.cashPaid ?? 0,
          onlinePaid: s.onlinePaid ?? 0,
          cashCollected: s.cashCollected ?? 0,
          changeGiven: s.changeGiven ?? 0,
          creditAmount: s.creditAmount ?? 0,
        };
        const existing = await findSaleRow(s.cloudId, s.receipt?.barcode);
        const sale = existing
          ? await prisma.localSale.update({
              where: { id: existing.id },
              data: {
                ...saleData,
                ledgerEntryId: cloudLedgerId ?? existing.ledgerEntryId,
              },
            })
          : await prisma.localSale.create({
              data: {
                ...saleData,
                createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
              },
            });

        await replaceSaleItems(sale.id, s.items ?? []);
        if (s.receipt) await attachReceipt(sale.id, s.receipt);

        salesCreated.push({ id: sale.id, name: saleLabel, localId: s.id });
      } catch (err) {
        salesFailed.push({
          id: s.id ?? 0,
          name: saleLabel,
          localId: s.id,
          error: err instanceof Error ? err.message : "Upsert failed",
        });
      }
    }

    for (const p of localPurchases) {
      const purchaseLabel = p.vendorName?.trim() || `Purchase ${p.createdAt ?? p.id ?? ""}`;
      try {
        const cloudLedgerId =
          p.ledgerEntryId != null ? (ledgerIdMap.get(p.ledgerEntryId) ?? null) : null;
        const purchaseData = {
          vendorId: p.vendorId ?? null,
          vendorName: p.vendorName ?? null,
          ledgerEntryId: cloudLedgerId,
          totalAmount: p.totalAmount ?? 0,
          cashPaid: p.cashPaid ?? 0,
          onlinePaid: p.onlinePaid ?? 0,
          cashCollected: p.cashCollected ?? 0,
          changeGiven: p.changeGiven ?? 0,
          creditAmount: p.creditAmount ?? 0,
        };
        const existing = await findPurchaseRow(p.cloudId, p);
        const purchase = existing
          ? await prisma.localPurchase.update({
              where: { id: existing.id },
              data: {
                ...purchaseData,
                ledgerEntryId: cloudLedgerId ?? existing.ledgerEntryId,
              },
            })
          : await prisma.localPurchase.create({
              data: {
                ...purchaseData,
                createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
              },
            });

        await prisma.localPurchaseItem.deleteMany({ where: { localPurchaseId: purchase.id } });
        for (const it of p.items ?? []) {
          await prisma.localPurchaseItem.create({
            data: {
              localPurchaseId: purchase.id,
              productId: it.productId ?? null,
              name: it.name,
              unitCost: it.unitCost ?? 0,
              quantity: it.quantity ?? 0,
              lineTotal: it.lineTotal ?? 0,
            },
          });
        }

        purchasesCreated.push({ id: purchase.id, name: purchaseLabel, localId: p.id });
      } catch (err) {
        purchasesFailed.push({
          id: p.id ?? 0,
          name: purchaseLabel,
          localId: p.id,
          error: err instanceof Error ? err.message : "Upsert failed",
        });
      }
    }

    // Sales / ledger / purchases never change storefront pages.
    if (categoriesUpdated.length || companiesUpdated.length) {
      // A hidden/renamed category or company changes every page listing its products.
      await revalidateCatalogForProducts(
        {
          OR: [
            { categoryId: { in: categoriesUpdated.map((c) => c.id) } },
            { companyId: { in: companiesUpdated.map((c) => c.id) } },
          ],
        },
        { categories: touchedCategories, companies: touchedCompanies }
      );
    } else if (productsUpdated.length) {
      revalidateCatalog({ categories: touchedCategories, companies: touchedCompanies });
    }
    return NextResponse.json({
      ok: true,
      localSalesCreated: salesCreated.length,
      ledgerCreated: ledgerCreated.length,
      localPurchasesCreated: purchasesCreated.length,
      productsUpdated,
      productsFailed,
      categoriesUpdated,
      categoriesFailed,
      companiesUpdated,
      companiesFailed,
      salesCreated,
      salesFailed,
      ledgerEntriesCreated: ledgerCreated,
      ledgerFailed,
      purchasesCreated,
      purchasesFailed,
    });
  } catch (error) {
    console.error("POS push sync error:", error);
    return NextResponse.json(
      { error: "Push sync failed" },
      { status: 500 }
    );
  }
}

function around(date: Date, ms = 2000) {
  return {
    gte: new Date(date.getTime() - ms),
    lte: new Date(date.getTime() + ms),
  };
}

async function findLedgerRow(
  cloudId: number | null | undefined,
  data: { name: string; phoneNumber: string; entryType: string; createdAt: Date }
) {
  if (cloudId) {
    const byId = await prisma.ledgerEntry.findUnique({ where: { id: cloudId } });
    if (byId) return byId;
  }
  return prisma.ledgerEntry.findFirst({
    where: {
      name: data.name,
      phoneNumber: data.phoneNumber,
      entryType: data.entryType,
      createdAt: around(data.createdAt),
    },
    orderBy: { id: "asc" },
  });
}

async function findSaleRow(cloudId?: number | null, barcode?: string) {
  if (cloudId) {
    const byId = await prisma.localSale.findUnique({ where: { id: cloudId } });
    if (byId) return byId;
  }
  if (barcode) {
    const receipt = await prisma.receipt.findUnique({
      where: { barcode },
      select: { localSaleId: true },
    });
    if (receipt?.localSaleId) {
      return prisma.localSale.findUnique({ where: { id: receipt.localSaleId } });
    }
  }
  return null;
}

async function findPurchaseRow(
  cloudId: number | null | undefined,
  p: { vendorId?: number | null; totalAmount: number; createdAt: string }
) {
  if (cloudId) {
    const byId = await prisma.localPurchase.findUnique({ where: { id: cloudId } });
    if (byId) return byId;
  }
  if (!p.createdAt) return null;
  return prisma.localPurchase.findFirst({
    where: {
      vendorId: p.vendorId ?? null,
      totalAmount: p.totalAmount ?? 0,
      createdAt: around(new Date(p.createdAt)),
    },
    orderBy: { id: "asc" },
  });
}

async function replaceSaleItems(saleId: number, items: PushSaleItem[]) {
  await prisma.localSaleItem.deleteMany({ where: { localSaleId: saleId } });
  for (const it of items) {
    await prisma.localSaleItem.create({
      data: {
        localSaleId: saleId,
        productId: it.productId ?? null,
        name: it.name,
        unitPrice: it.unitPrice ?? 0,
        discount: it.discount ?? 0,
        quantity: it.quantity ?? 0,
        lineTotal: it.lineTotal ?? 0,
      },
    });
  }
}

async function attachReceipt(saleId: number, receiptPayload: PushReceipt) {
  const receipt = await prisma.receipt.upsert({
    where: { barcode: receiptPayload.barcode },
    create: {
      barcode: receiptPayload.barcode,
      localSaleId: saleId,
      netTotal: receiptPayload.netTotal ?? 0,
      grossTotal: receiptPayload.grossTotal ?? 0,
      discountTotal: receiptPayload.discountTotal ?? 0,
      saleType: receiptPayload.saleType ?? "POS",
      createdAt: receiptPayload.createdAt ? new Date(receiptPayload.createdAt) : new Date(),
    },
    update: {
      localSaleId: saleId,
      netTotal: receiptPayload.netTotal ?? 0,
      grossTotal: receiptPayload.grossTotal ?? 0,
      discountTotal: receiptPayload.discountTotal ?? 0,
      saleType: receiptPayload.saleType ?? "POS",
    },
  });
  await prisma.localSale.updateMany({
    where: { receiptId: receipt.id, id: { not: saleId } },
    data: { receiptId: null },
  });
  await prisma.localSale.update({
    where: { id: saleId },
    data: { receiptId: receipt.id },
  });
  await prisma.localSaleItem.updateMany({
    where: { localSaleId: saleId },
    data: { receiptId: receipt.id },
  });
}
