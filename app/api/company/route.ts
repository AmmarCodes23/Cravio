import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Prisma } from "@/generated/prisma/client";
import { ensureAdminOrPosApiKey } from "@/lib/pos-or-admin-auth";

type CompanyInput = {
  name: string;
  image?: string | null;
  productCount?: number | string;
  categoryIds?: Array<number | string>;
  categories?: Array<string | null>;
};

const parseCategoryIds = async (input: unknown) => {
  if (!input) return [];

  if (Array.isArray(input)) {
    const ids = input
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));
    if (ids.length === 0) return [];

    const categories = await prisma.category.findMany({
      where: { id: { in: ids } },
    });
    return categories.map((c) => ({ id: c.id }));
  }

  const names = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? [input]
      : [];
  const normalized = names.map((n) => n.trim()).filter(Boolean);
  if (normalized.length === 0) return [];

  const categories = await prisma.category.findMany({
    where: { name: { in: normalized } },
  });
  return categories.map((c) => ({ id: c.id }));
};

// POST - Seed companies or create companies
export async function POST(request: Request) {
  try {
    const authError = await ensureAdminOrPosApiKey(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const seed = searchParams.get("seed");

    // If seed parameter is present, read from JSON file and seed database
    if (seed === "true") {
      const filePath = path.join(process.cwd(), "app", "Data", "companydata.json");

      if (!fs.existsSync(filePath)) {
        return NextResponse.json(
          {
            error: "companydata.json not found in app/Data folder",
            searchedPath: filePath,
          },
          { status: 404 }
        );
      }

      const fileContent = fs.readFileSync(filePath, "utf-8");
      const companies = JSON.parse(fileContent);

      if (!Array.isArray(companies) || companies.length === 0) {
        return NextResponse.json(
          { error: "Invalid companydata.json format" },
          { status: 400 }
        );
      }

      const batchSize = 10;
      const results: Array<Awaited<ReturnType<typeof prisma.company.upsert>>> = [];

      for (let i = 0; i < companies.length; i += batchSize) {
        const batch = companies.slice(i, i + batchSize);

        const batchResults = await Promise.all(
          batch.map(async (company) => {
            const categoryNames: string[] = Array.isArray(company.categories)
              ? company.categories
              : company.category
                ? [company.category]
                : [];

            const normalizedCategories = categoryNames
              .map((c) => (c ?? "").toString().trim())
              .filter((c) => c.length > 0);

            const categoryRecords = await Promise.all(
              normalizedCategories.map((categoryName) =>
                prisma.category.upsert({
                  where: { name: categoryName },
                  update: {},
                  create: {
                    name: categoryName,
                    url: categoryName,
                  },
                })
              )
            );

            const companyRecord = await prisma.company.upsert({
              where: { name: company.name },
              update: {
                image: company.image || null,
                productCount: company.productCount || 0,
              },
              create: {
                name: company.name,
                image: company.image || null,
                productCount: company.productCount || 0,
              },
            });

            if (categoryRecords.length > 0) {
              await prisma.company.update({
                where: { id: companyRecord.id },
                data: {
                  categories: {
                    set: categoryRecords.map((c) => ({ id: c.id })),
                  },
                },
              });
            }

            return companyRecord;
          })
        );

        results.push(...batchResults);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      return NextResponse.json(
        {
          message: "Companies seeded successfully",
          count: results.length,
          companies: results,
        },
        { status: 201 }
      );
    }

    // Regular POST - accept single object or array
    const body = (await request.json()) as unknown;
    const payloads = (Array.isArray(body) ? body : [body]) as CompanyInput[];

    if (payloads.length === 0) {
      return NextResponse.json(
        { error: "Request body must include at least one company" },
        { status: 400 }
      );
    }

    for (const company of payloads) {
      if (!company?.name) {
        return NextResponse.json(
          { error: "Each company must have a 'name' field" },
          { status: 400 }
        );
      }
    }

    const results: Array<Awaited<ReturnType<typeof prisma.company.upsert>>> = [];

    for (const company of payloads) {
      let categoryIds: { id: number }[] = [];
      if (company.categoryIds !== undefined) {
        categoryIds = await parseCategoryIds(company.categoryIds);
      } else if (company.categories !== undefined) {
        categoryIds = await parseCategoryIds(company.categories);
      }

      const productCount =
        company.productCount !== undefined && Number.isFinite(Number(company.productCount))
          ? Number(company.productCount)
          : 0;

      const companyRecord = await prisma.company.upsert({
        where: { name: company.name },
        update: {
          image: company.image || null,
          productCount,
        },
        create: {
          name: company.name,
          image: company.image || null,
          productCount,
        },
      });

      if (categoryIds.length > 0) {
        await prisma.company.update({
          where: { id: companyRecord.id },
          data: {
            categories: {
              set: categoryIds,
            },
          },
        });
      }

      results.push(companyRecord);
    }

    return NextResponse.json(
      {
        message: "Companies created/updated successfully",
        count: results.length,
        companies: results,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error creating companies:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Duplicate company name" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to create companies",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

// GET - Fetch all companies
export async function GET() {
  try {
    const companies = await prisma.company.findMany({
      orderBy: {
        name: "asc",
      },
      include: {
        categories: true,
      },
    });

    const shaped = companies.map((c) => ({
      id: c.id,
      name: c.name,
      image: c.image,
      productCount: c.productCount,
      categories: c.categories.map((cat) => cat.name),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    return NextResponse.json(shaped);
  } catch (error) {
    console.error("Error fetching companies:", error);
    return NextResponse.json(
      { error: "Failed to fetch companies" },
      { status: 500 }
    );
  }
}