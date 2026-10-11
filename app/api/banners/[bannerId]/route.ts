import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureStaffOrPosApiKey } from "@/lib/pos-or-admin-auth";
import { revalidateCatalog } from "@/lib/catalog";

type BannerPatch = {
  imageUrl?: string;
  title?: string | null;
  linkUrl?: string | null;
  sortOrder?: number | string;
  isActive?: boolean;
};

function normalizeOptionalUrl(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ bannerId: string }> }
) {
  try {
    const authError = await ensureStaffOrPosApiKey(request);
    if (authError) return authError;

    const { bannerId } = await params;
    const id = Number(bannerId);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid banner id" }, { status: 400 });
    }

    const body = (await request.json()) as BannerPatch;
    const data: {
      imageUrl?: string;
      title?: string | null;
      linkUrl?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    } = {};

    if (body.imageUrl !== undefined) {
      const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
      if (!imageUrl) {
        return NextResponse.json({ error: "imageUrl cannot be empty" }, { status: 400 });
      }
      data.imageUrl = imageUrl;
    }

    if (body.title !== undefined) {
      data.title =
        typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;
    }

    if (body.linkUrl !== undefined) {
      data.linkUrl = normalizeOptionalUrl(body.linkUrl);
    }

    if (body.sortOrder !== undefined && body.sortOrder !== null && body.sortOrder !== "") {
      const sortOrder = Number(body.sortOrder);
      if (Number.isNaN(sortOrder)) {
        return NextResponse.json({ error: "sortOrder must be a number" }, { status: 400 });
      }
      data.sortOrder = sortOrder;
    }

    if (typeof body.isActive === "boolean") {
      data.isActive = body.isActive;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const banner = await prisma.marketingBanner.update({
      where: { id },
      data,
    });

    revalidateCatalog({ banners: true });
    return NextResponse.json(banner);
  } catch (error: unknown) {
    console.error("Error updating banner:", error);
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    if (code === "P2025") {
      return NextResponse.json({ error: "Banner not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update banner" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ bannerId: string }> }
) {
  try {
    const authError = await ensureStaffOrPosApiKey(_request);
    if (authError) return authError;

    const { bannerId } = await params;
    const id = Number(bannerId);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid banner id" }, { status: 400 });
    }

    await prisma.marketingBanner.delete({ where: { id } });
    revalidateCatalog({ banners: true });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("Error deleting banner:", error);
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    if (code === "P2025") {
      return NextResponse.json({ error: "Banner not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete banner" }, { status: 500 });
  }
}
