import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidateCatalog } from "@/lib/catalog";
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

type NamedId = { id: number; name: string };
type FailedNamedId = NamedId & { error: string };

/** Request body when pushing local POS data to cloud (Sync = reflect local to cloud). */
type PushSyncBody = {
  localSales?: Array<{
    vendorId?: number | null;
    vendorName?: string | null;
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
    items: Array<{
      productId?: number | null;
      name: string;
      unitPrice: number;
      discount: number;
      quantity: number;
      lineTotal: number;
    }>;
    receipt?: {
      barcode: string;
      netTotal: number;
      grossTotal: number;
      discountTotal: number;
      saleType: string;
      createdAt: string;
    } | null;
  }>;
  ledger?: Array<{
    id?: number;
    name: string;
    phoneNumber: string;
    address?: string | null;
    entryType: string;
    balance: number;
    due: boolean;
    createdAt: string;
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
 * POST: Push local POS data (catalog + LocalSales + Ledger) to cloud.
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
    const salesCreated: NamedId[] = [];

    // Categories first (products reference them by id/name)
    for (const c of categories) {
      const label = c.name?.trim() || `Category #${c.id}`;
      try {
        const existing = await prisma.category.findUnique({ where: { id: c.id } });
        if (!existing) {
          categoriesFailed.push({ id: c.id, name: label, error: "Not found on cloud" });
          continue;
        }
        const updated = await prisma.category.update({
          where: { id: c.id },
          data: {
            ...(c.name !== undefined ? { name: String(c.name) } : {}),
            ...(c.url !== undefined ? { url: String(c.url || existing.url) } : {}),
            ...(c.image !== undefined ? { image: c.image } : {}),
            ...(c.isHidden !== undefined ? { isHidden: Boolean(c.isHidden) } : {}),
          },
        });
        categoriesUpdated.push({ id: updated.id, name: updated.name });
      } catch (err) {
        categoriesFailed.push({
          id: c.id,
          name: label,
          error: err instanceof Error ? err.message : "Update failed",
        });
      }
    }

    for (const c of companies) {
      const label = c.name?.trim() || `Company #${c.id}`;
      try {
        const existing = await prisma.company.findUnique({ where: { id: c.id } });
        if (!existing) {
          companiesFailed.push({ id: c.id, name: label, error: "Not found on cloud" });
          continue;
        }
        const updated = await prisma.company.update({
          where: { id: c.id },
          data: {
            ...(c.name !== undefined ? { name: String(c.name) } : {}),
            ...(c.image !== undefined ? { image: c.image } : {}),
            ...(c.isHidden !== undefined ? { isHidden: Boolean(c.isHidden) } : {}),
          },
        });
        companiesUpdated.push({ id: updated.id, name: updated.name });
      } catch (err) {
        companiesFailed.push({
          id: c.id,
          name: label,
          error: err instanceof Error ? err.message : "Update failed",
        });
      }
    }

    for (const p of products) {
      const label = p.name?.trim() || `Product #${p.id}`;
      try {
        const existing = await prisma.product.findUnique({ where: { id: p.id } });
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
          const clash = await prisma.product.findFirst({
            where: { barcode: nextBarcode, NOT: { id: p.id } },
            select: { id: true, name: true },
          });
          if (clash) {
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

        const updated = await prisma.product.update({
          where: { id: p.id },
          data: {
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
          },
        });
        productsUpdated.push({ id: updated.id, name: updated.name });
      } catch (err) {
        productsFailed.push({
          id: p.id,
          name: label,
          error: err instanceof Error ? err.message : "Update failed",
        });
      }
    }

    // Create ledger entries first so we can map local ids to cloud ids for sales
    const ledgerIdMap = new Map<number, number>();
    for (const e of ledger) {
      const created = await prisma.ledgerEntry.create({
        data: {
          name: e.name,
          phoneNumber: e.phoneNumber,
          address: e.address ?? null,
          entryType: e.entryType ?? "RECEIVABLE",
          balance: e.balance ?? 0,
          due: e.due ?? true,
          createdAt: e.createdAt ? new Date(e.createdAt) : new Date(),
        },
      });
      if (e.id != null) ledgerIdMap.set(e.id, created.id);
      ledgerCreated.push({ id: created.id, name: created.name });
    }

    for (const s of localSales) {
      const cloudLedgerId = s.ledgerEntryId != null ? ledgerIdMap.get(s.ledgerEntryId) ?? null : null;
      const sale = await prisma.localSale.create({
        data: {
          vendorId: s.vendorId ?? null,
          vendorName: s.vendorName ?? null,
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
          createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
        },
      });
      const createdItems: { id: number }[] = [];
      for (const it of s.items ?? []) {
        const item = await prisma.localSaleItem.create({
          data: {
            localSaleId: sale.id,
            productId: it.productId ?? null,
            name: it.name,
            unitPrice: it.unitPrice ?? 0,
            discount: it.discount ?? 0,
            quantity: it.quantity ?? 0,
            lineTotal: it.lineTotal ?? 0,
          },
        });
        createdItems.push(item);
      }
      if (s.receipt) {
        const receipt = await prisma.receipt.upsert({
          where: { barcode: s.receipt.barcode },
          create: {
            barcode: s.receipt.barcode,
            localSaleId: sale.id,
            netTotal: s.receipt.netTotal ?? 0,
            grossTotal: s.receipt.grossTotal ?? 0,
            discountTotal: s.receipt.discountTotal ?? 0,
            saleType: s.receipt.saleType ?? "POS",
            createdAt: s.receipt.createdAt ? new Date(s.receipt.createdAt) : new Date(),
          },
          update: { localSaleId: sale.id },
        });
        // receiptId is unique: clear it from any other sale that had this receipt (e.g. re-push or barcode reuse)
        await prisma.localSale.updateMany({
          where: { receiptId: receipt.id, id: { not: sale.id } },
          data: { receiptId: null },
        });
        await prisma.localSale.update({
          where: { id: sale.id },
          data: { receiptId: receipt.id },
        });
        for (const item of createdItems) {
          await prisma.localSaleItem.update({
            where: { id: item.id },
            data: { receiptId: receipt.id },
          });
        }
      }
      const saleLabel =
        s.vendorName?.trim() ||
        s.receipt?.barcode ||
        `Sale ${s.createdAt ?? sale.id}`;
      salesCreated.push({ id: sale.id, name: saleLabel });
    }

    revalidateCatalog();
    return NextResponse.json({
      ok: true,
      localSalesCreated: localSales.length,
      ledgerCreated: ledger.length,
      productsUpdated,
      productsFailed,
      categoriesUpdated,
      categoriesFailed,
      companiesUpdated,
      companiesFailed,
      salesCreated,
      ledgerEntriesCreated: ledgerCreated,
    });
  } catch (error) {
    console.error("POS push sync error:", error);
    return NextResponse.json(
      { error: "Push sync failed" },
      { status: 500 }
    );
  }
}
