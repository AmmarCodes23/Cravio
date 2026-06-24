import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { ensureAdminOrPosApiKey } from "@/lib/pos-or-admin-auth";

const parseNullableNumber = (value: unknown) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId: productIdParam } = await params;
  const productId = Number(productIdParam);
  if (!Number.isFinite(productId)) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json(product);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const authError = await ensureAdminOrPosApiKey(request);
    if (authError) return authError;

    const { productId: productIdParam } = await params;
    const productId = Number(productIdParam);
    if (!Number.isFinite(productId)) {
      return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
    }

    const body = (await request.json()) as {
      name?: string;
      consumerPrice?: number | string;
      retailPrice?: number | string;
      bulkPrice?: number | string;
      bulkLimit?: number | string | null;
      costPrice?: number | string | null;
      image?: string | null;
      description?: string | null;
      companyId?: number | string;
      categoryId?: number | string;
    };
    const data: Prisma.ProductUpdateInput = {};

    if (body.name !== undefined) data.name = String(body.name);

    if (body.consumerPrice !== undefined) {
      const val = Number(body.consumerPrice);
      if (!Number.isFinite(val)) {
        return NextResponse.json({ error: "Invalid consumer price" }, { status: 400 });
      }
      data.consumerPrice = val;
      data.price = val;
    }

    if (body.retailPrice !== undefined) {
      const val = Number(body.retailPrice);
      if (!Number.isFinite(val)) {
        return NextResponse.json({ error: "Invalid retail price" }, { status: 400 });
      }
      data.retailPrice = val;
      data.originalPrice = val;
    }

    if (body.bulkPrice !== undefined) {
      const val = Number(body.bulkPrice);
      if (!Number.isFinite(val)) {
        return NextResponse.json({ error: "Invalid bulk price" }, { status: 400 });
      }
      data.bulkPrice = val;
    }

    if (body.bulkLimit !== undefined) {
      const val = parseNullableNumber(body.bulkLimit);
      if (val === undefined) {
        return NextResponse.json({ error: "Invalid bulk limit" }, { status: 400 });
      }
      data.bulkLimit = val;
    }

    if (body.costPrice !== undefined) {
      if (body.costPrice === null || body.costPrice === "") {
        data.costPrice = null;
      } else {
        const val = Number(body.costPrice);
        if (!Number.isFinite(val)) {
          return NextResponse.json({ error: "Invalid cost price" }, { status: 400 });
        }
        data.costPrice = val;
      }
    }

    if (body.image !== undefined) {
      data.image = body.image || "/images/dummyimage.png";
    }

    if (body.description !== undefined) {
      data.description = body.description || null;
    }

    if (body.companyId !== undefined) {
      const companyId = Number(body.companyId);
      if (!Number.isFinite(companyId)) {
        return NextResponse.json({ error: "Invalid company id" }, { status: 400 });
      }
      const company = await prisma.company.findUnique({ where: { id: companyId } });
      if (!company) {
        return NextResponse.json({ error: "Company not found" }, { status: 404 });
      }
      data.companyRel = { connect: { id: company.id } };
      data.company = company.name;
      data.companyImage = company.image || "/images/dummyimage.png";
    }

    if (body.categoryId !== undefined) {
      const categoryId = Number(body.categoryId);
      if (!Number.isFinite(categoryId)) {
        return NextResponse.json({ error: "Invalid category id" }, { status: 400 });
      }
      const category = await prisma.category.findUnique({ where: { id: categoryId } });
      if (!category) {
        return NextResponse.json({ error: "Category not found" }, { status: 404 });
      }
      data.categoryRel = { connect: { id: category.id } };
      data.category = category.name;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided for update" },
        { status: 400 }
      );
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data,
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error("Error updating product:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: "Failed to update product",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const authError = await ensureAdminOrPosApiKey(request);
    if (authError) return authError;

    const { productId: productIdParam } = await params;
    const productId = Number(productIdParam);
    if (!Number.isFinite(productId)) {
      return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
    }

    const orderUsage = await prisma.orderProduct.count({ where: { productId } });
    if (orderUsage > 0) {
      return NextResponse.json(
        { error: "Cannot delete a product that exists in orders" },
        { status: 409 }
      );
    }

    await prisma.product.delete({ where: { id: productId } });
    return NextResponse.json({ message: "Product deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting product:", error);
    return NextResponse.json(
      {
        error: "Failed to delete product",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}


