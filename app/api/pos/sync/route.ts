import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
};

/**
 * POST: Push local POS data (LocalSales, Ledger) to cloud so all data is consistent.
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
    }

    return NextResponse.json({
      ok: true,
      localSalesCreated: localSales.length,
      ledgerCreated: ledger.length,
    });
  } catch (error) {
    console.error("POS push sync error:", error);
    return NextResponse.json(
      { error: "Push sync failed" },
      { status: 500 }
    );
  }
}
