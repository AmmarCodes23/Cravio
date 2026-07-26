import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureStaffOrPosApiKey } from "@/lib/pos-or-admin-auth";

type BannerInput = {
  imageUrl?: string;
  title?: string | null;
  sortOrder?: number | string;
  isActive?: boolean;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let includeInactive = searchParams.get("includeInactive") === "true";
    if (includeInactive) {
      const authError = await ensureStaffOrPosApiKey(request);
      if (authError) includeInactive = false;
    }

    const banners = await prisma.marketingBanner.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });

    return NextResponse.json(banners);
  } catch (error) {
    console.error("Error fetching banners:", error);
    return NextResponse.json({ error: "Failed to fetch banners" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authError = await ensureStaffOrPosApiKey(request);
    if (authError) return authError;

    const body = (await request.json()) as BannerInput;
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
    }

    const sortOrder =
      body.sortOrder === undefined || body.sortOrder === null || body.sortOrder === ""
        ? 0
        : Number(body.sortOrder);
    if (Number.isNaN(sortOrder)) {
      return NextResponse.json({ error: "sortOrder must be a number" }, { status: 400 });
    }

    const title =
      typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;

    const banner = await prisma.marketingBanner.create({
      data: {
        imageUrl,
        title,
        sortOrder,
        isActive: body.isActive ?? true,
      },
    });

    return NextResponse.json(banner, { status: 201 });
  } catch (error) {
    console.error("Error creating banner:", error);
    return NextResponse.json({ error: "Failed to create banner" }, { status: 500 });
  }
}
