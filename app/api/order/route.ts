import { prisma } from "@/lib/prisma";
import { getRequestSession } from "@/lib/request-session";
import { NextResponse } from "next/server";
import { resend } from "@/lib/resend";
import { buildOrderEmail } from "@/lib/emailTemplates";
import type { Session } from "next-auth";

type SessionWithRole = Session & { user: { id?: string; email?: string | null; role?: string } };

type OrderProductInput = { productId: number; quantity?: number };
type NewVendorInput = { name?: string; address?: string | null; phoneNumber?: string };
type OrderRequestBody = {
  phoneNumber?: string;
  orderInfo?: string;
  address?: string;
  orderPerson?: string;
  products?: OrderProductInput[];
  p2pVendorId?: number | null;
  newVendor?: NewVendorInput | null;
};

export async function POST(req: Request) {
  try {
    const session = (await getRequestSession(req)) as SessionWithRole | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = (await req.json()) as OrderRequestBody;
    const {
      phoneNumber,
      orderInfo,
      address,
      orderPerson,
      products, // Array of { productId, quantity }
      p2pVendorId,
      newVendor, // optional { name, address, phoneNumber }
    } = body;

    // Validate required fields
    if (!phoneNumber || !orderInfo || !address || !orderPerson || !products || products.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const accountEmail = session.user.email || "";

    // Get the last order number and increment it
    const lastOrder = await prisma.order.findFirst({
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true }
    });

    const orderNumber = lastOrder ? lastOrder.orderNumber + 1 : 1;

    let finalVendorId = p2pVendorId ?? null;

    // Allow employees/admins to create vendor inline
    const role = session.user?.role;
    if (!finalVendorId && newVendor && (role === "EMPLOYEE" || role === "ADMIN")) {
      if (!newVendor.name || !newVendor.phoneNumber) {
        return NextResponse.json({ error: "New vendor name and phone are required" }, { status: 400 });
      }
      const createdVendor = await prisma.p2PVendor.create({
        data: {
          name: newVendor.name.trim(),
          address: newVendor.address?.trim() || null,
          phoneNumber: newVendor.phoneNumber.trim(),
          createdById: session.user.id,
        },
      });
      finalVendorId = createdVendor.id;
    }

    // Create the order with order products
    const order = await prisma.order.create({
      data: {
        orderNumber,
        accountEmail,
        phoneNumber,
        orderInfo,
        address,
        orderPerson,
        userId,
        p2pVendorId: finalVendorId ?? undefined,
        status: 'ACCEPTED', // New orders are pending by default
        orderProducts: {
          create: products.map((product) => ({
            productId: product.productId,
            quantity: product.quantity || 1
          }))
        }
      },
      include: {
        orderProducts: {
          include: {
            product: true
          }
        }
      }
    });

    // Fire-and-forget email for order placed
    if (process.env.RESEND_API_KEY && accountEmail) {
      const email = buildOrderEmail({
        order: { ...order, status: "PLACED" },
        type: "PLACED",
      });
      resend.emails.send({
        from: "Cravio <orders@craviopk.com>",
        to: accountEmail,
        subject: email.subject,
        html: email.html,
      }).catch((err) => console.error("Resend order placed email failed", err));
    }

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}

