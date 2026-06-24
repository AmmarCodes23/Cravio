import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { ensureAdminOrPosApiKey } from "@/lib/pos-or-admin-auth";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

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

    const body = (await request.json()) as {
      name?: string;
      url?: string;
      image?: string | null;
      productCount?: number | string;
    };
    const data: Prisma.CategoryUpdateInput = {};

    if (body.name !== undefined) {
      data.name = String(body.name);
    }

    if (body.url !== undefined) {
      data.url = body.url ? String(body.url) : undefined;
    }

    if (body.image !== undefined) {
      data.image = body.image ? String(body.image).trim() : null;
    }

    if (body.productCount !== undefined) {
      const count = Number(body.productCount);
      if (!Number.isFinite(count) || count < 0) {
        return NextResponse.json({ error: "Invalid product count" }, { status: 400 });
      }
      data.productCount = count;
    }

    if (data.name && !data.url) {
      data.url = slugify(String(data.name));
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

    await prisma.category.delete({ where: { id: categoryId } });
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


