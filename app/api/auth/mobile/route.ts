import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signMobileToken, verifyGoogleIdToken } from "@/lib/mobile-auth";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { idToken?: string };
    const idToken = body.idToken?.trim();

    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    const googleUser = await verifyGoogleIdToken(idToken);
    if (!googleUser) {
      return NextResponse.json({ error: "Invalid Google token" }, { status: 401 });
    }

    let user = await prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name ?? null,
          image: googleUser.picture ?? null,
          emailVerified: new Date(),
        },
      });
    } else if (!user.name || !user.image) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: user.name ?? googleUser.name ?? null,
          image: user.image ?? googleUser.picture ?? null,
        },
      });
    }

    const token = await signMobileToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Mobile auth failed:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
