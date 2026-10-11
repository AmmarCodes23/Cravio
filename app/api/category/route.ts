import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Prisma } from "@/generated/prisma/client";
import { ensureAdminOrPosApiKey } from "@/lib/pos-or-admin-auth";
import { CATALOG_CACHE_CONTROL, getCategories, revalidateCatalogForProducts } from "@/lib/catalog";
import { looksLikeRemoteUrl, resolveCategorySlug } from "@/lib/company-slug";

type CategoryInput = {
  name: string;
  url?: string;
  image?: string | null;
  productCount?: number;
  isHidden?: boolean;
};

function categoryWriteFields(category: CategoryInput) {
  const image =
    category.image?.trim() ||
    (looksLikeRemoteUrl(category.url) ? category.url!.trim() : undefined);
  return {
    url: resolveCategorySlug(category.name, category.url),
    ...(image ? { image } : {}),
  };
}

// POST - Seed categories or create categories
export async function POST(request: Request) {
  try {
    const authError = await ensureAdminOrPosApiKey(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const seed = searchParams.get("seed");

    // If seed parameter is present, read from JSON file and seed database
    if (seed === "true") {
      const filePath = path.join(process.cwd(), "app", "Data", "categories.json");

      if (!fs.existsSync(filePath)) {
        return NextResponse.json(
          {
            error: "categories.json not found in app/Data folder",
            searchedPath: filePath,
          },
          { status: 404 }
        );
      }

      const fileContent = fs.readFileSync(filePath, "utf-8");
      const categories = JSON.parse(fileContent) as unknown;

      if (!Array.isArray(categories) || categories.length === 0) {
        return NextResponse.json(
          { error: "Invalid categories.json format" },
          { status: 400 }
        );
      }

      const results = await Promise.all(
        (categories as CategoryInput[]).map((category) => {
          const fields = categoryWriteFields(category);
          return prisma.category.upsert({
            where: { name: category.name },
            update: {
              ...fields,
              productCount: category.productCount || 0,
              ...(category.isHidden !== undefined ? { isHidden: Boolean(category.isHidden) } : {}),
            },
            create: {
              name: category.name,
              url: fields.url,
              image: fields.image,
              productCount: category.productCount || 0,
              isHidden: category.isHidden !== undefined ? Boolean(category.isHidden) : false,
            },
          });
        })
      );

      await revalidateCatalogForProducts(
        { categoryId: { in: results.map((c) => c.id) } },
        { categories: results.map((c) => c.name) }
      );
      return NextResponse.json(
        {
          message: "Categories seeded successfully",
          count: results.length,
          categories: results,
        },
        { status: 201 }
      );
    }

    // Regular POST - accept single object or array
    const body = (await request.json()) as unknown;
    const payloads = (Array.isArray(body) ? body : [body]) as CategoryInput[];

    if (payloads.length === 0) {
      return NextResponse.json(
        { error: "Request body must include at least one category" },
        { status: 400 }
      );
    }

    for (const category of payloads) {
      if (!category?.name) {
        return NextResponse.json(
          { error: "Each category must have a 'name' field" },
          { status: 400 }
        );
      }
    }

    const results = await Promise.all(
      payloads.map((category) => {
        const fields = categoryWriteFields(category);
        return prisma.category.upsert({
          where: { name: category.name },
          update: {
            ...fields,
            productCount: category.productCount || 0,
            ...(category.isHidden !== undefined ? { isHidden: Boolean(category.isHidden) } : {}),
          },
          create: {
            name: category.name,
            url: fields.url,
            image: fields.image,
            productCount: category.productCount || 0,
            isHidden: category.isHidden !== undefined ? Boolean(category.isHidden) : false,
          },
        });
      })
    );

    await revalidateCatalogForProducts(
      { categoryId: { in: results.map((c) => c.id) } },
      { categories: results.map((c) => c.name) }
    );
    return NextResponse.json(
      {
        message: "Categories created/updated successfully",
        count: results.length,
        categories: results,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error creating categories:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Duplicate category name or URL" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to create categories",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

// GET - Fetch all categories
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let includeHidden = searchParams.get("includeHidden") === "true";
    if (includeHidden) {
      const authError = await ensureAdminOrPosApiKey(request);
      if (authError) includeHidden = false;
    }

    const categories = includeHidden
      ? await prisma.category.findMany({
          orderBy: { name: "asc" },
        })
      : await getCategories();

    return NextResponse.json(
      categories,
      includeHidden
        ? undefined
        : { headers: { "Cache-Control": CATALOG_CACHE_CONTROL } }
    );
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}