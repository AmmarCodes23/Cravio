import { prisma } from "@/lib/prisma";
import { getRequestSession } from "@/lib/request-session";
import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import type { Session } from "next-auth";

type SessionWithRole = Session & { user: { id?: string; role?: string } };

export async function GET(req: Request) {
  try {
    const session = (await getRequestSession(req)) as SessionWithRole | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userRole = session.user?.role;

    let whereClause: Prisma.OrderWhereInput = {};

    // If user is employee or admin, show all orders. Otherwise, show only user's orders.
    if (userRole !== "EMPLOYEE" && userRole !== "ADMIN") {
      whereClause = { userId: session.user.id };
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        orderProducts: {
          include: {
            product: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

