import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import { ensureAdminOrPosApiKey } from "@/lib/pos-or-admin-auth";

type ProductInput = {
  name?: string;
  companyId?: number | string;
  company?: string;
  categoryId?: number | string;
  category?: string;
  retailPrice?: number | string;
  consumerPrice?: number | string;
  bulkPrice?: number | string;
  bulkLimit?: number | string | null;
  /** Landed / average unit cost (inventory, purchases); optional. */
  costPrice?: number | string | null;
  image?: string | null;
  description?: string | null;
};

const parseOptionalNumber = (value: unknown) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

async function buildProductData(input: ProductInput) {
  if (!input.name) throw new Error("Product name is required");

  const companyId = input.companyId !== undefined ? Number(input.companyId) : undefined;
  const categoryId = input.categoryId !== undefined ? Number(input.categoryId) : undefined;

  const company = companyId
    ? await prisma.company.findUnique({ where: { id: companyId } })
    : input.company
      ? await prisma.company.findFirst({ where: { name: input.company } })
      : null;

  if (!company) throw new Error("Company not found");

  const category = categoryId
    ? await prisma.category.findUnique({ where: { id: categoryId } })
    : input.category
      ? await prisma.category.findFirst({ where: { name: input.category } })
      : null;

  if (!category) throw new Error("Category not found");

  const retailPrice = Number(input.retailPrice ?? input.consumerPrice ?? input.bulkPrice);
  const consumerPrice = Number(input.consumerPrice ?? retailPrice ?? input.bulkPrice);
  const bulkPrice = Number(input.bulkPrice ?? retailPrice ?? consumerPrice);
  const bulkLimit = parseOptionalNumber(input.bulkLimit);

  if (![retailPrice, consumerPrice, bulkPrice].every(Number.isFinite)) {
    throw new Error("Invalid price values");
  }

  const costPrice = parseOptionalNumber(input.costPrice);

  return {
    name: input.name,
    company: company.name,
    category: category.name,
    price: consumerPrice,
    originalPrice: retailPrice,
    retailPrice,
    consumerPrice,
    bulkPrice,
    bulkLimit,
    costPrice,
    image: input.image || "/images/dummyimage.png",
    description: input.description || null,
    companyImage: company.image || "/images/dummyimage.png",
    companyRel: { connect: { id: company.id } },
    categoryRel: { connect: { id: category.id } },
  };
}

export async function GET() {
  try {
    const products = await prisma.product.findMany();
    return NextResponse.json(products);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

// POST - Seed products or create new ones
export async function POST(request: Request) {
  try {
    const authError = await ensureAdminOrPosApiKey(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const seed = searchParams.get("seed");

    // Seed products from CSV
    if (seed === "true") {
      const filePath = path.join(process.cwd(), "app", "Data", "products_updated.csv");

      if (!fs.existsSync(filePath)) {
        return NextResponse.json(
          {
            error: "products_updated.csv not found in app/Data folder",
            searchedPath: filePath,
          },
          { status: 404 }
        );
      }

      const csvContent = fs.readFileSync(filePath, "utf-8");
      const lines = csvContent.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        return NextResponse.json(
          { error: "CSV file must have at least a header row and one data row" },
          { status: 400 }
        );
      }

      const rows = lines.slice(1).map((line) => line.split(","));

      const [companies, categories] = await Promise.all([
        prisma.company.findMany(),
        prisma.category.findMany(),
      ]);

      const companyMap = new Map(companies.map((c) => [c.name.toLowerCase(), c]));
      const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c]));

      const batchSize = 50;
      const results: Array<Awaited<ReturnType<typeof prisma.product.create>>> = [];

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);

        const batchPromises = batch.map(async (row) => {
          try {
            const productName = row[0]?.trim();
            const categoryName = row[1]?.trim();
            const companyName = row[3]?.trim();
            const retailPrice = Number(row[4]?.trim());
            const consumerPrice = Number(row[5]?.trim());
            const bulkPrice = Number(row[6]?.trim());
            const bulkLimitRaw = Number(row[7]?.trim());
            const bulkLimit =
              Number.isFinite(bulkLimitRaw) && bulkLimitRaw > 0 ? bulkLimitRaw : null;
            const imageUrl1 = row[8]?.trim();

            const hasAllPrices =
              Number.isFinite(retailPrice) &&
              Number.isFinite(consumerPrice) &&
              Number.isFinite(bulkPrice) &&
              retailPrice > 0 &&
              consumerPrice > 0 &&
              bulkPrice > 0;

            if (!productName || !categoryName || !companyName || !hasAllPrices) {
              console.warn(`Skipping invalid row: ${row.join(",")}`);
              return null;
            }

            const company = companyMap.get(companyName.toLowerCase());
            const category = categoryMap.get(categoryName.toLowerCase());

            if (!company || !category) {
              console.warn(`Lookup failed for ${companyName}/${categoryName}`);
              return null;
            }

            const productData = {
              name: productName,
              company: companyName,
              category: categoryName,
              price: consumerPrice,
              originalPrice: retailPrice,
              retailPrice,
              consumerPrice,
              bulkPrice,
              bulkLimit,
              image: imageUrl1 || "/images/dummyimage.png",
              description: null,
              companyImage: company.image || "/images/dummyimage.png",
              companyRel: { connect: { id: company.id } },
              categoryRel: { connect: { id: category.id } },
            };

            const existingProduct = await prisma.product.findFirst({
              where: { name: productName },
            });

            if (existingProduct) {
              return prisma.product.update({
                where: { id: existingProduct.id },
                data: productData,
              });
            }

            return prisma.product.create({
              data: productData,
            });
          } catch (error) {
            console.error(`Error processing row: ${row.join(",")}`, error);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...(batchResults.filter(Boolean) as Awaited<ReturnType<typeof prisma.product.create>>[]));

        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      return NextResponse.json(
        {
          message: "Products seeded successfully",
          count: results.length,
          products: results.slice(0, 10),
        },
        { status: 201 }
      );
    }

    // Regular creation (single object or array)
    const body = (await request.json()) as unknown;
    const payloads = (Array.isArray(body) ? body : [body]) as ProductInput[];

    if (payloads.length === 0) {
      return NextResponse.json(
        { error: "Request body must include at least one product" },
        { status: 400 }
      );
    }

    const products = await Promise.all(
      payloads.map(async (productInput) => {
        const data = await buildProductData(productInput);
        return prisma.product.create({ data });
      })
    );

    return NextResponse.json(
      { message: "Products created successfully", count: products.length, products },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error processing products:", error);
    return NextResponse.json(
      {
        error: "Failed to process products",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
