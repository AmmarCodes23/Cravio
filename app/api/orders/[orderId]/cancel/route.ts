import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/request-session";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { buildOrderEmail } from "@/lib/emailTemplates";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await getRequestSession(request);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { orderId } = await params;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.userId !== session.user.id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status === "CANCELLED") {
      return NextResponse.json({ error: "Order already cancelled" }, { status: 400 });
    }

    if (order.status === "DELIVERED") {
      return NextResponse.json({ error: "Delivered orders cannot be cancelled" }, { status: 400 });
    }

    const createdAt = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt);
    const diffMinutes = (Date.now() - createdAt.getTime()) / 60000;
    if (diffMinutes > 10) {
      return NextResponse.json(
        { error: "Order cannot be cancelled as rider is on the way" },
        { status: 400 }
      );
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED" },
      include: {
        orderProducts: {
          include: { product: true },
        },
      },
    });

    if (process.env.RESEND_API_KEY && updated.accountEmail) {
      const email = buildOrderEmail({
        order: { ...updated, status: "CANCELLED" },
        type: "CANCELLED",
      });
      resend.emails
        .send({
          from: "Cravio <orders@craviopk.com>",
          to: updated.accountEmail,
          subject: email.subject,
          html: email.html,
        })
        .catch((err) => console.error("Resend cancel email failed", err));
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error cancelling order:", error);
    return NextResponse.json({ error: "Failed to cancel order" }, { status: 500 });
  }
}

