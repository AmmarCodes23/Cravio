"use client";

import { useState, useMemo, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Home, UserCircle, ClipboardList, ShoppingBag } from "lucide-react";
import { useCartContext } from "../context/CartContext";
import { useSession } from "next-auth/react";
import MobileCartModal from "./MobileCartModal";
import MobileSearchDrawer from "./MobileSearchDrawer";
import { useLoginModal } from "../context/LoginModalContext";

const MobileBottomNav = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const { cartItems } = useCartContext();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { setIsOpen, setIsEmployee } = useLoginModal();

  // listen for navbar trigger
  useEffect(() => {
    const handleOpen = () => setIsSearchOpen(true);
    const handleClose = () => setIsSearchOpen(false);
    window.addEventListener("mobile-search-open", handleOpen as EventListener);
    window.addEventListener("mobile-search-close", handleClose as EventListener);
    return () => {
      window.removeEventListener("mobile-search-open", handleOpen as EventListener);
      window.removeEventListener("mobile-search-close", handleClose as EventListener);
    };
  }, []);

  // listen for "View cart" banner tap
  useEffect(() => {
    const handleCartOpen = () => setIsCartOpen(true);
    window.addEventListener("mobile-cart-open", handleCartOpen as EventListener);
    return () => {
      window.removeEventListener("mobile-cart-open", handleCartOpen as EventListener);
    };
  }, []);

  const itemCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  // Hide on checkout page
  if (pathname === "/checkout") return null;

  const navItems = [
    { key: "home", label: "Home", icon: <Home className="w-5 h-5" />, onClick: () => router.push("/", { scroll: false }) },
    {
      key: "profile",
      label: "Profile",
      icon: <UserCircle className="w-5 h-5" />,
      onClick: () => {
        if (session) return router.push("/account", { scroll: false });
        setIsEmployee(false);
        setIsOpen(true);
      },
    },
    {
      key: "orders",
      label: "Orders",
      icon: <ClipboardList className="w-5 h-5" />,
      onClick: () => {
        if (session) return router.push("/orders", { scroll: false });
        setIsEmployee(false);
        setIsOpen(true);
      },
    },
    { key: "cart", label: "Cart", icon: <ShoppingBag className="w-5 h-5" />, onClick: () => setIsCartOpen(true) },
  ];

  const handleSearchClose = () => {
    setIsSearchOpen(false);
    const event = new CustomEvent("mobile-search-close");
    window.dispatchEvent(event);
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-[9997] md:hidden bg-white border-t border-slate-200 shadow-lg">
        <div className="grid grid-cols-4 text-center py-2">
          {navItems.map((item) => (
            <button
              key={item.key}
              className="flex flex-col items-center justify-center gap-1 text-[11px] text-slate-700"
              onClick={item.onClick}
            >
              <div className="relative">
                {item.icon}
                {item.key === "cart" && itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-primary text-accents rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                    {itemCount}
                  </span>
                )}
              </div>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <MobileCartModal isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <MobileSearchDrawer isOpen={isSearchOpen} onClose={handleSearchClose} />
    </>
  );
};

export default MobileBottomNav;

