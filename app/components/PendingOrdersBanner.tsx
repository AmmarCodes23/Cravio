"use client"
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { Package, X, Clock } from 'lucide-react';
import type { PendingOrder, UserOrder } from "../Data/database";

const ORDERS_POLL_MS = 60_000;

const PendingOrdersBanner = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
  if (!session) return;

  // The SSE route holds a dedicated Postgres connection and a long-running
  // function per tab. Only open it when the user actually has an order in
  // flight; otherwise poll /api/orders (cheap, cached per user) every minute.
  let cancelled = false;
  let eventSource: EventSource | null = null;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  const fetchPendingOrders = async (): Promise<PendingOrder[] | null> => {
    try {
      const res = await fetch("/api/orders");
      if (!res.ok) return null;
      const orders: UserOrder[] = await res.json();
      return orders.filter(
        (o) => o.status !== "DELIVERED" && o.status !== "CANCELLED"
      );
    } catch (err) {
      console.error("Initial fetch error:", err);
      return null;
    }
  };

  const poll = async () => {
    const pending = await fetchPendingOrders();
    if (cancelled) return;
    if (pending) setPendingOrders(pending);
    if (pending && pending.length > 0) {
      openStream();
    } else {
      pollTimer = setTimeout(poll, ORDERS_POLL_MS);
    }
  };

  const openStream = () => {
    eventSource = new EventSource(`/api/order-events?cb=${Date.now()}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "PENDING_ORDERS":
            setPendingOrders(data.orders);
            break;
          case "NEW_ORDER":
            setPendingOrders((prev) => [...prev, data.order]);
            break;
          case "ORDER_UPDATED":
            setPendingOrders((prev) =>
              prev.map((o) => (o.id === data.order.id ? data.order : o))
            );
            break;
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    eventSource.onerror = (event) => {
      // Only log warnings instead of full object
      console.warn(
        "SSE connection error, connection may retry automatically.",
        event
      );
      // Do NOT close the EventSource; the browser reconnects automatically
    };
  };

  poll();

  return () => {
    cancelled = true;
    eventSource?.close();
    if (pollTimer) clearTimeout(pollTimer);
  };
}, [session]);


  // Don't show banner on orders page or checkout page
  if (!isVisible || pendingOrders.length === 0 || pathname === '/orders' || pathname === '/checkout') {
    return null;
  }

  const handleViewOrders = () => {
    router.push('/orders');
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:bottom-4 md:left-4 md:right-auto md:max-w-md">
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-2xl rounded-t-xl md:rounded-xl p-4 border-t-2 border-amber-600">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4" />
              <p className="font-bold font-brasika text-lg">
                {pendingOrders.length} Pending {pendingOrders.length === 1 ? 'Order' : 'Orders'}
              </p>
            </div>
            <p className="text-sm text-white/90 mb-3">
              You have {pendingOrders.length} {pendingOrders.length === 1 ? 'order' : 'orders'} waiting to be delivered
            </p>
            <button
              onClick={handleViewOrders}
              className="bg-white text-amber-600 hover:bg-amber-50 font-bold py-2 px-4 rounded-lg text-sm transition-colors font-sifonn"
            >
              View Orders
            </button>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
            aria-label="Close banner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PendingOrdersBanner;

