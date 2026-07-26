import { prisma } from "@/lib/prisma";
import { getRequestSession } from "@/lib/request-session";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await getRequestSession(req);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      phoneNumber: true,
      name: true,
    },
  });

  return NextResponse.json(user);
}
