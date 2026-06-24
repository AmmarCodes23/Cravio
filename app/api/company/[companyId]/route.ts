import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { ensureAdminOrPosApiKey } from "@/lib/pos-or-admin-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId: companyIdParam } = await params;
  const companyId = Number(companyIdParam);
  if (!Number.isFinite(companyId)) {
    return NextResponse.json({ error: "Invalid company id" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { categories: true },
  });

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  return NextResponse.json(company);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const authError = await ensureAdminOrPosApiKey(request);
    if (authError) return authError;

    const { companyId: companyIdParam } = await params;
    const companyId = Number(companyIdParam);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: "Invalid company id" }, { status: 400 });
    }

    const body = (await request.json()) as {
      name?: string;
      image?: string | null;
      productCount?: number | string;
      categoryIds?: Array<number | string>;
    };
    const data: Prisma.CompanyUpdateInput = {};

    if (body.name !== undefined) data.name = String(body.name);
    if (body.image !== undefined) data.image = body.image || null;

    if (body.productCount !== undefined) {
      const productCount = Number(body.productCount);
      if (!Number.isFinite(productCount) || productCount < 0) {
        return NextResponse.json({ error: "Invalid product count" }, { status: 400 });
      }
      data.productCount = productCount;
    }

    const categoriesInput = body.categoryIds;
    let categorySet:
      | {
          id: number;
        }[]
      | undefined;

    if (categoriesInput !== undefined) {
      const ids = Array.isArray(categoriesInput)
        ? categoriesInput.map((id) => Number(id)).filter((id) => Number.isFinite(id))
        : [];

      const categories =
        ids.length > 0
          ? await prisma.category.findMany({ where: { id: { in: ids } } })
          : [];

      categorySet = categories.map((c) => ({ id: c.id }));
    }

    if (Object.keys(data).length === 0 && categorySet === undefined) {
      return NextResponse.json(
        { error: "No fields provided to update" },
        { status: 400 }
      );
    }

    const updated = await prisma.company.update({
      where: { id: companyId },
      data,
    });

    if (categorySet !== undefined) {
      await prisma.company.update({
        where: { id: companyId },
        data: {
          categories: {
            set: categorySet,
          },
        },
      });
    }

    if (data.name || data.image) {
      await prisma.product.updateMany({
        where: { companyId },
        data: {
          ...(data.name ? { company: data.name } : {}),
          ...(data.image !== undefined
            ? { companyImage: data.image ? String(data.image) : "/images/dummyimage.png" }
            : {}),
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error("Error updating company:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: "Failed to update company",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const authError = await ensureAdminOrPosApiKey(request);
    if (authError) return authError;

    const { companyId: companyIdParam } = await params;
    const companyId = Number(companyIdParam);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: "Invalid company id" }, { status: 400 });
    }

    const productUsage = await prisma.product.count({ where: { companyId } });
    if (productUsage > 0) {
      return NextResponse.json(
        { error: "Cannot delete a company that has products" },
        { status: 409 }
      );
    }

    await prisma.company.delete({ where: { id: companyId } });
    return NextResponse.json({ message: "Company deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting company:", error);
    return NextResponse.json(
      {
        error: "Failed to delete company",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}


