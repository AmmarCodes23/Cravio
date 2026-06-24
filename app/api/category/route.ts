import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Prisma } from "@/generated/prisma/client";
import { ensureAdminOrPosApiKey } from "@/lib/pos-or-admin-auth";

type CategoryInput = {
  name: string;
  url?: string;
  image?: string | null;
  productCount?: number;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

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

      const categoriesWithUrls = (categories as CategoryInput[]).map(
        (category) => ({
          ...category,
          url: category.url || slugify(category.name),
        })
      );

      const results = await Promise.all(
        categoriesWithUrls.map((category) =>
          prisma.category.upsert({
            where: { name: category.name },
            update: {
              url: category.url,
              image: category.image ?? undefined,
              productCount: category.productCount || 0,
            },
            create: {
              name: category.name,
              url: category.url,
              image: category.image ?? undefined,
              productCount: category.productCount || 0,
            },
          })
        )
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

    const categoriesWithUrls = payloads.map((category) => ({
      ...category,
      url: category.url || slugify(category.name),
    }));

    const results = await Promise.all(
      categoriesWithUrls.map((category) =>
        prisma.category.upsert({
          where: { name: category.name },
          update: {
            url: category.url,
            image: category.image ?? undefined,
            productCount: category.productCount || 0,
          },
          create: {
            name: category.name,
            url: category.url,
            image: category.image ?? undefined,
            productCount: category.productCount || 0,
          },
        })
      )
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
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}