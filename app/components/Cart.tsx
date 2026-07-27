"use client";

import { CheckCircle, Truck, Plus, Minus, ShoppingBag } from "lucide-react";
import { useCartContext } from "../context/CartContext";
import { Vendor } from "../Data/database";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocation } from "../context/LocationContext";
import { useUserInfo } from "../context/UserInfoContext";
import { useSession } from "next-auth/react";
import { useLoginModal } from "@/app/context/LoginModalContext";
import { useVendorContext } from "../context/VendorContext";

const Cart: React.FC = () => {
  const { cartItems, updateQuantity, removeItem, CartOpen } = useCartContext();
  const [subTotal, setSubTotal] = useState<number>(0);
  const router = useRouter();
  const { selectedAddress } = useLocation();
  const { phoneNumber, city, street, building } = useUserInfo();
  const { data: session } = useSession();
  const { setIsOpen } = useLoginModal();
  const { vendor, setOpenVendorModal, setVendor } = useVendorContext();
  const { ensureVendorCart, setActiveVendorId } = useCartContext();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isEmployee = role === "EMPLOYEE";

  useEffect(() => {
    const consumerSubtotal = cartItems.reduce(
      (sum, item) =>
        sum +
        (item.product.consumerPrice ?? item.product.price ?? 0) *
          item.quantity,
      0
    );
    const bulkEligible = isEmployee || consumerSubtotal >= 20000;
    const saleSubtotal = cartItems.reduce((sum, item) => {
      const consumer = item.product.consumerPrice ?? item.product.price ?? 0;
      const retail = item.product.retailPrice ?? item.product.price ?? consumer;
      const bulk = item.product.bulkPrice ?? retail;
      const sale = bulkEligible ? bulk : consumer;
      return sum + sale * item.quantity;
    }, 0);
    setSubTotal(saleSubtotal);
  }, [cartItems, isEmployee]);

  const consumerSubtotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) =>
          sum +
          (item.product.consumerPrice ?? item.product.price ?? 0) *
            item.quantity,
        0
      ),
    [cartItems]
  );
  const bulkEligible = isEmployee || consumerSubtotal >= 20000;

  const itemCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const originalTotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) =>
          sum + (item.product.price ?? item.product.consumerPrice ?? 0) * item.quantity,
        0
      ),
    [cartItems]
  );

  const savings = originalTotal - subTotal;

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const res = await fetch("/api/vendors");
        if (res.ok) {
          const data = await res.json();
          setVendors(data || []);
        }
      } catch (err) {
        console.error("Failed to load vendors", err);
      }
    };
    if (role === "EMPLOYEE") {
      fetchVendors();
    }
  }, [role]);

  const handleSelectVendor = (id: string) => {
    if (!id) {
      setVendor(null);
      setActiveVendorId(null);
      return;
    }
    const selected = vendors.find((v) => String(v.id) === id);
    if (selected) {
      setVendor({ ...selected, address: selected.address ?? "" });
      setActiveVendorId(String(selected.id));
      ensureVendorCart(String(selected.id));
    }
  };

  const getItemPrice = (item: typeof cartItems[0]) => {
    return (bulkEligible || isEmployee)
      ? item.product.bulkPrice ?? item.product.price
      : item.product.consumerPrice ?? item.product.price;
  };

  const getOriginalPrice = (item: typeof cartItems[0]) => {
    return item.product.price ?? item.product.consumerPrice ?? 0;
  };

  const getDiscount = (item: typeof cartItems[0]) => {
    const original = getOriginalPrice(item);
    const sale = getItemPrice(item);
    if (original > sale && original > 0) {
      return Math.round(((original - sale) / original) * 100);
    }
    return 0;
  };

  return (
    <aside
      className={`${
        cartItems.length === 0 || !CartOpen ? "hidden" : "hidden md:flex"
      } md:flex-col md:h-full md:self-stretch w-[420px] shrink-0 bg-white shadow-2xl z-50`}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 bg-white">
        <h2 className="text-xl font-bold text-slate-900 font-sifonn">Cart</h2>
      </div>

      {/* Fulfillment bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-semibold text-slate-800">Cravio Grocery</p>
            <p className="text-xs text-slate-500">Fulfilled by Cravio</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-slate-700">Standard delivery</p>
          <p className="text-xs text-slate-500">
            {new Date(Date.now() + 86400000).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Progress bars */}
      {cartItems.length > 0 && (
        <div className="border-b border-slate-100 divide-y divide-slate-100">
          {/* Minimum order bar */}
          <div className="flex items-center gap-3 px-5 py-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800 mb-1.5">
                {subTotal >= 3000 || isEmployee
                  ? "Yay! You can now place your order"
                  : `Add Rs ${(3000 - subTotal).toFixed(0)} more for minimum order`}
              </p>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (subTotal / 3000) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <Truck className="w-6 h-6 text-primary shrink-0" />
          </div>

          {/* Bulk pricing bar */}
          {!isEmployee && (
            <div className="flex items-center gap-3 px-5 py-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800 mb-1.5">
                  {consumerSubtotal >= 20000
                    ? "Bulk pricing unlocked!"
                    : `Add Rs ${(20000 - consumerSubtotal).toLocaleString()} more for bulk pricing`}
                </p>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (consumerSubtotal / 20000) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <span className="text-lg shrink-0">💰</span>
            </div>
          )}
        </div>
      )}

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto">
        {cartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16">
            <ShoppingBag className="w-16 h-16 text-slate-300 mb-4" />
            <p className="text-slate-600 font-semibold">Your cart is empty</p>
            <p className="text-sm text-slate-400 mt-1">Add items to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
              {cartItems.map((item, index: number) => {
                const salePrice = getItemPrice(item);
                const origPrice = getOriginalPrice(item);
                const discount = getDiscount(item);

                return (
                  <div
                    key={`${item.product.id}-${index}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
                  >
                    {/* Product image */}
                    <div className="w-18 h-18 rounded-xl border border-slate-200 overflow-hidden flex-shrink-0 bg-white p-1.5">
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Name + Price */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-800 line-clamp-2 leading-tight">
                        {item.product.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-bold text-slate-900">
                          Rs. {salePrice.toLocaleString()}
                        </span>
                        {origPrice > salePrice && (
                          <span className="text-xs text-slate-400 line-through">
                            Rs. {origPrice.toLocaleString()}
                          </span>
                        )}
                      </div>
                      {!isEmployee && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {bulkEligible ? "Bulk" : "Consumer"} · Line: Rs.{" "}
                          {(salePrice * item.quantity).toLocaleString()}
                        </p>
                      )}
                    </div>

                    {/* Discount badge + Quantity controls */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {discount > 0 && (
                        <span className="bg-primary text-accents text-[10px] font-bold px-2 py-0.5 rounded-md">
                          {discount}% OFF
                        </span>
                      )}
                      <div className="flex items-center border border-primary rounded-lg overflow-hidden">
                        <button
                          className="px-2.5 py-1.5 text-primary hover:bg-primary/10 transition-colors"
                          onClick={() =>
                            item.quantity <= 1
                              ? removeItem(item.product.id)
                              : updateQuantity(item.product.id, item.quantity - 1)
                          }
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="px-3 py-1.5 text-sm font-bold text-slate-800 min-w-[32px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          className="px-2.5 py-1.5 text-primary hover:bg-primary/10 transition-colors"
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
        )}
      </div>

      {/* Vendor selector for employees */}
      {isEmployee && cartItems.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100 bg-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-700 font-semibold">Vendor</span>
            <button
              className="text-sm text-primary hover:underline"
              onClick={() => setOpenVendorModal(true)}
            >
              + New vendor
            </button>
          </div>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            value={vendor?.id ? String(vendor.id) : ""}
            onChange={(e) => handleSelectVendor(e.target.value)}
          >
            <option value="">Select vendor</option>
            {vendors.map((v) => (
              <option key={v.id} value={String(v.id)}>
                {v.name} • {v.phoneNumber}
              </option>
            ))}
          </select>
          {!vendor && (
            <p className="text-xs text-red-600 mt-1">
              Select or create a vendor before checkout.
            </p>
          )}
        </div>
      )}

      {/* Footer */}
      {cartItems.length > 0 && (
        <div className="border-t border-slate-200 bg-white px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-slate-900">
                  Rs. {subTotal.toLocaleString()}
                </span>
                <span className="text-sm text-slate-500">
                  {itemCount} {itemCount === 1 ? "Item" : "Items"}
                </span>
              </div>
              {savings > 0 && (
                <p className="text-xs text-primary font-semibold mt-0.5">
                  You&apos;ve saved Rs. {savings.toLocaleString()}
                </p>
              )}
              <p className="text-xs text-slate-400 mt-0.5">
                {bulkEligible
                  ? "Bulk pricing applied (order ≥ Rs 20,000)"
                  : "Consumer pricing. Bulk at Rs 20,000+"}
              </p>
            </div>
          </div>
          <button
            disabled={cartItems.length === 0}
            className="w-full disabled:cursor-not-allowed disabled:bg-gray-400 bg-primary hover:bg-primary/90 text-accents font-bold py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 font-sifonn"
            onClick={() => {
              if (!session) {
                setIsOpen(true);
              } else if (!selectedAddress || !phoneNumber || !city || !building || !street) {
                router.push("/user-info");
              } else if (role === "EMPLOYEE" && !vendor) {
                setOpenVendorModal(true);
              } else {
                router.push("/checkout");
              }
            }}
          >
            CHECKOUT
          </button>
        </div>
      )}
    </aside>
  );
};

export default Cart;
