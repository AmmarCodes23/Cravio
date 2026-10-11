import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { ensureAdminOrPosApiKey } from "@/lib/pos-or-admin-auth";
import { revalidateCatalog, revalidateCatalogForProducts } from "@/lib/catalog";
import {
  categorySlug,
  looksLikeRemoteUrl,
  resolveCategorySlug,
} from "@/lib/company-slug";
import { nextStoredImage } from "@/lib/product-image";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const { categoryId: categoryIdParam } = await params;
  const categoryId = Number(categoryIdParam);
  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ error: "Invalid category id" }, { status: 400 });
  }

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  return NextResponse.json(category);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const authError = await ensureAdminOrPosApiKey(request);
    if (authError) return authError;

    const { categoryId: categoryIdParam } = await params;
    const categoryId = Number(categoryIdParam);
    if (!Number.isFinite(categoryId)) {
      return NextResponse.json({ error: "Invalid category id" }, { status: 400 });
    }

    const existing = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { name: true, url: true, image: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      name?: string;
      url?: string;
      image?: string | null;
      productCount?: number | string;
      isHidden?: boolean;
    };
    const data: Prisma.CategoryUpdateInput = {};

    if (body.isHidden !== undefined) {
      data.isHidden = Boolean(body.isHidden);
    }

    if (body.name !== undefined) {
      data.name = String(body.name);
    }

    if (body.image !== undefined) {
      data.image = nextStoredImage(body.image, existing.image);
    } else if (looksLikeRemoteUrl(body.url)) {
      data.image = nextStoredImage(body.url!.trim(), existing.image);
    }

    const nameForSlug = body.name !== undefined ? String(body.name) : existing.name;
    if (body.url !== undefined && !looksLikeRemoteUrl(body.url) && body.url.trim()) {
      data.url = resolveCategorySlug(nameForSlug, body.url);
    } else if (
      body.name !== undefined ||
      looksLikeRemoteUrl(body.url) ||
      looksLikeRemoteUrl(existing.url)
    ) {
      data.url = categorySlug(nameForSlug);
    }

    if (body.productCount !== undefined) {
      const count = Number(body.productCount);
      if (!Number.isFinite(count) || count < 0) {
        return NextResponse.json({ error: "Invalid product count" }, { status: 400 });
      }
      data.productCount = count;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No fields provided to update" },
        { status: 400 }
      );
    }

    const updated = await prisma.category.update({
      where: { id: categoryId },
      data,
    });

    if (data.name) {
      await prisma.product.updateMany({
        where: { categoryId },
        data: { category: updated.name },
      });
    }

    await revalidateCatalogForProducts(
      { categoryId },
      { categories: [existing.name, updated.name] }
    );
    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error("Error updating category:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: "Failed to update category",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const authError = await ensureAdminOrPosApiKey(request);
    if (authError) return authError;

    const { categoryId: categoryIdParam } = await params;
    const categoryId = Number(categoryIdParam);
    if (!Number.isFinite(categoryId)) {
      return NextResponse.json({ error: "Invalid category id" }, { status: 400 });
    }

    const productUsage = await prisma.product.count({ where: { categoryId } });
    if (productUsage > 0) {
      return NextResponse.json(
        { error: "Cannot delete a category that has products" },
        { status: 409 }
      );
    }

    const deleted = await prisma.category.delete({ where: { id: categoryId } });
    revalidateCatalog({ categories: [deleted.name] });
    return NextResponse.json({ message: "Category deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting category:", error);
    return NextResponse.json(
      {
        error: "Failed to delete category",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}


